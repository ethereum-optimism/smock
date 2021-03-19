/* Imports: External */
import hre from 'hardhat'
import { Contract, ContractFactory, ethers } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { HardhatNetworkProvider } from 'hardhat/internal/hardhat-network/provider/provider'

/* Imports: Internal */
import { MockContract, MockReturnValue, SmockOptions, SmockSpec } from './types'
import { bindSmock } from './binding'
import { toHexString, fromHexString, makeRandomAddress } from '../utils'

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
 * @return Interface generated from the spec.
 */
const makeContractInterfaceFromSpec = (
  spec: SmockSpec
): ethers.utils.Interface => {
  if (spec instanceof Contract) {
    return spec.interface
  } else if (spec instanceof ContractFactory) {
    return spec.interface
  } else if (spec instanceof ethers.utils.Interface) {
    return spec
  } else {
    return new ethers.utils.Interface(spec)
  }
}

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
    makeContractInterfaceFromSpec(spec),
    opts.provider || hre.ethers.provider // TODO: Probably check that this exists.
  ) as MockContract

  // Pull out a reference to the VM. Shouldn't change during the course of execution. Might though.
  // Haven't thought about it enough.
  const vm: any = (provider as any)._node._vm

  contract.smocked = {}
  for (const functionName of Object.keys(contract.functions)) {
    contract.smocked[functionName] = {
      get calls() {
        return vm._smock.calls[contract.address.toLowerCase()]
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

  // TODO: Make this less of a hack.
  ;(contract as any)._smockit = function (
    data: Buffer
  ): {
    resolve: 'return' | 'revert'
    returnValue: Buffer
  } {
    const calldata = toHexString(data)
    const sighash = toHexString(data.slice(0, 4))

    const fn = this.interface.getFunction(sighash)
    const params = this.interface.decodeFunctionData(fn, calldata)

    const mockFn = this.smocked[fn.name]
    const rawReturnValue =
      mockFn.will.returnValue instanceof Function
        ? mockFn.will.returnValue(...params)
        : mockFn.will.returnValue

    let encodedReturnValue: string = '0x'
    if (rawReturnValue !== undefined) {
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

    return {
      resolve: mockFn.will.resolve,
      returnValue: fromHexString(encodedReturnValue),
    }
  }

  bindSmock(contract, provider)

  return contract
}
