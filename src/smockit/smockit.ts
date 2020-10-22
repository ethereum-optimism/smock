/* Imports: External */
import bre from '@nomiclabs/buidler'
import { Contract, ContractFactory, ContractInterface, ethers } from 'ethers'

/* Imports: Internal */
import { MockContract, MockReturnValue } from './types'
import { bindSmock } from './binding'
import { toHexString, fromHexString, makeRandomAddress } from '../utils'

export const smockit = async (
  spec: ContractInterface | Contract | ContractFactory,
  provider?: any
): Promise<MockContract> => {
  if (bre.network.name !== 'buidlerevm') {
    throw new Error('smockit currently only supports the buidlerevm.')
  }

  if (!bre.network.provider['_node' as any]) {
    await bre.network.provider['_init' as any]()
  }

  const iface: ContractInterface = (spec as any).interface || spec
  const contract = new ethers.Contract(
    makeRandomAddress(),
    iface,
    provider || (spec as any).provider
  ) as MockContract

  const vm = bre.network.provider['_node' as any]['_vm' as any]
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
            } catch {}

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

  contract._smockit = function (
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

  bindSmock(contract)

  return contract
}
