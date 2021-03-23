/* Imports: External */
import hre from 'hardhat'
import { Contract, ContractFactory, ethers } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { HardhatNetworkProvider } from 'hardhat/internal/hardhat-network/provider/provider'
import { toHexString, fromHexString } from '@eth-optimism/core-utils'

/* Imports: Internal */
import {
  isArtifact,
  MockContract,
  MockContractFunction,
  MockReturnValue,
  SmockedVM,
  SmockOptions,
  SmockSpec,
} from './types'
import { bindSmock } from './binding'
import { makeRandomAddress } from '../utils'

/**
 * Finds the "base" Ethereum provider of the current hardhat environment.
 *
 * Basically, hardhat uses a system of nested providers where each provider wraps the next and
 * "provides" some extra features. When you're running on top of the "hardhat evm" the bottom of
 * this series of providers is the "HardhatNetworkProvider":
 * https://github.com/nomiclabs/hardhat/blob/master/packages/hardhat-core/src/internal/hardhat-network/provider/provider.ts
 * This object has direct access to the node (provider._node), which in turn has direct access to
 * the ethereumjs-vm instance (provider._node._vm). So it's quite useful to be able to find this
 * object reliably!
 * @param hre hardhat runtime environment to pull the base provider from.
 * @return base hardhat network provider
 */
const findBaseHardhatProvider = (
  runtime: HardhatRuntimeEnvironment
): HardhatNetworkProvider => {
  // This function is pretty approximate. Haven't spent enough time figuring out if there's a more
  // reliable way to get the base provider. I can imagine a future in which there's some circular
  // references and this function ends up looping. So I'll just preempt this by capping the maximum
  // search depth.
  const maxLoopIterations = 1024
  let currentLoopIterations = 0

  // Search by looking for the internal "_wrapped" variable. Base provider doesn't have this
  // property (at least for now!).
  let provider = runtime.network.provider
  while ((provider as any)._wrapped !== undefined) {
    provider = (provider as any)._wrapped

    // Just throw if we ever end up in (what seems to be) an infinite loop.
    currentLoopIterations += 1
    if (currentLoopIterations > maxLoopIterations) {
      throw new Error(
        `[smock]: unable to find base hardhat provider. are you sure you're running locally?`
      )
    }
  }

  // TODO: Figure out a reliable way to do a type check here. Source for inspiration:
  // https://github.com/nomiclabs/hardhat/blob/master/packages/hardhat-core/src/internal/hardhat-network/provider/provider.ts
  return provider as any
}

/**
 * Generates an ethers Interface instance when given a smock spec. Meant for standardizing the
 * various input types we might reasonably want to support.
 * @param spec Smock specification object. Thing you want to base the interface on.
 * @param hre Hardhat runtime environment. Used so we can
 * @return Interface generated from the spec.
 */
const makeContractInterfaceFromSpec = async (
  spec: SmockSpec
): Promise<ethers.utils.Interface> => {
  if (spec instanceof Contract) {
    return spec.interface
  } else if (spec instanceof ContractFactory) {
    return spec.interface
  } else if (spec instanceof ethers.utils.Interface) {
    return spec
  } else if (isArtifact(spec)) {
    return new ethers.utils.Interface(spec.abi)
  } else if (typeof spec === 'string') {
    try {
      return new ethers.utils.Interface(spec)
    } catch (err) {
      return (await hre.ethers.getContractFactory(spec)).interface
    }
  } else {
    return new ethers.utils.Interface(spec)
  }
}

/**
 * Creates a mock contract function from a real contract function.
 * @param contract Contract object to make a mock function for.
 * @param functionName Name of the function to mock.
 * @param vm Virtual machine reference, necessary for call assertions to work.
 * @return Mock contract function.
 */
const smockifyFunction = (
  contract: Contract,
  functionName: string,
  vm: SmockedVM
): MockContractFunction => {
  return {
    reset: () => {
      return
    },
    get calls() {
      return vm._smockState.calls[contract.address.toLowerCase()]
        .map((calldataBuf: Buffer) => {
          const sighash = toHexString(calldataBuf.slice(0, 4))
          const fragment = contract.interface.getFunction(sighash)

          let data: any = toHexString(calldataBuf)
          try {
            data = contract.interface.decodeFunctionData(fragment.name, data)
          } catch (e) {
            console.error(e)
          }

          return {
            functionName: fragment.name,
            data,
          }
        })
        .filter((functionResult: any) => {
          return functionResult.functionName === functionName
        })
        .map((functionResult: any) => {
          return functionResult.data
        })
    },
    will: {
      get return() {
        const fn: any = () => {
          this.resolve = 'return'
          this.returnValue = undefined
        }

        fn.with = (returnValue?: MockReturnValue): void => {
          this.resolve = 'return'
          this.returnValue = returnValue
        }

        return fn
      },
      get revert() {
        const fn: any = () => {
          this.resolve = 'revert'
          this.returnValue = undefined
        }

        fn.with = (revertValue?: string): void => {
          this.resolve = 'revert'
          this.returnValue = revertValue
        }

        return fn
      },
      resolve: 'return',
    },
  }
}

/**
 * Turns a specification into a mock contract.
 * @param spec Smock contract specification.
 * @param opts Optional additional settings.
 */
export const smockit = async (
  spec: SmockSpec,
  opts: SmockOptions = {}
): Promise<MockContract> => {
  // Only support native hardhat runtime, haven't bothered to figure it out for anything else.
  if (hre.network.name !== 'hardhat') {
    throw new Error(
      `[smock]: smock is only compatible with the "hardhat" network, got: ${hre.network.name}`
    )
  }

  // Find the provider object. See comments for `getBaseHardhatProvider`
  const provider = findBaseHardhatProvider(hre)

  // Sometimes the VM hasn't been initialized by the time we get here, depending on what the user
  // is doing with hardhat (e.g., sending a transaction before calling this function will
  // initialize the vm). Initialize it here if it hasn't been already.
  if ((provider as any)._node === undefined) {
    await (provider as any)._init()
  }

  // Generate the contract object that we're going to attach our fancy functions to. Doing it this
  // way is nice because it "feels" more like a contract (as long as you're using ethers).
  const contract = new ethers.Contract(
    opts.address || makeRandomAddress(),
    await makeContractInterfaceFromSpec(spec),
    opts.provider || hre.ethers.provider // TODO: Probably check that this exists.
  ) as MockContract

  // Start by smocking the fallback.
  contract.smocked = {
    fallback: smockifyFunction(
      contract,
      'fallback',
      (provider as any)._node._vm
    ),
  }

  // Smock the rest of the contract functions.
  for (const functionName of Object.keys(contract.functions)) {
    contract.smocked[functionName] = smockifyFunction(
      contract,
      functionName,
      (provider as any)._node._vm
    )
  }

  // TODO: Make this less of a hack.
  ;(contract as any)._smockit = async function (
    data: Buffer
  ): Promise<{
    resolve: 'return' | 'revert'
    functionName: string
    rawReturnValue: any
    returnValue: Buffer
    gasUsed: number
  }> {
    let fn: any
    try {
      const sighash = toHexString(data.slice(0, 4))
      fn = this.interface.getFunction(sighash)
    } catch (err) {
      fn = null
    }

    let params: any
    let mockFn: any
    if (fn !== null) {
      params = this.interface.decodeFunctionData(fn, toHexString(data))
      mockFn = this.smocked[fn.name]
    } else {
      params = toHexString(data)
      mockFn = this.smocked.fallback
    }

    const rawReturnValue =
      mockFn.will?.returnValue instanceof Function
        ? await mockFn.will.returnValue(...params)
        : mockFn.will.returnValue

    let encodedReturnValue: string = '0x'
    if (rawReturnValue !== undefined) {
      if (mockFn.will?.resolve === 'revert') {
        if (typeof rawReturnValue !== 'string') {
          throw new Error(
            `Smock: Tried to revert with a non-string (or non-bytes) type: ${typeof rawReturnValue}`
          )
        }

        if (rawReturnValue.startsWith('0x')) {
          encodedReturnValue = rawReturnValue
        } else {
          const errorface = new ethers.utils.Interface([
            {
              inputs: [
                {
                  name: '_reason',
                  type: 'string',
                },
              ],
              name: 'Error',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
          ])

          encodedReturnValue = errorface.encodeFunctionData('Error', [
            rawReturnValue,
          ])
        }
      } else {
        if (fn === null) {
          encodedReturnValue = rawReturnValue
        } else {
          try {
            encodedReturnValue = this.interface.encodeFunctionResult(fn, [
              rawReturnValue,
            ])
          } catch (err) {
            if (err.code === 'INVALID_ARGUMENT') {
              try {
                encodedReturnValue = this.interface.encodeFunctionResult(
                  fn,
                  rawReturnValue
                )
              } catch {
                if (typeof rawReturnValue !== 'string') {
                  throw new Error(
                    `Could not properly encode mock return value for ${fn.name}`
                  )
                }

                encodedReturnValue = rawReturnValue
              }
            } else {
              throw err
            }
          }
        }
      }
    } else {
      if (fn === null) {
        encodedReturnValue = '0x'
      } else {
        encodedReturnValue = '0x' + '00'.repeat(2048)
      }
    }

    return {
      resolve: mockFn.will?.resolve,
      functionName: fn ? fn.name : null,
      rawReturnValue,
      returnValue: fromHexString(encodedReturnValue),
      gasUsed: mockFn.gasUsed || 0,
    }
  }

  await bindSmock(contract, provider)

  return contract
}
