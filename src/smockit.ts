/* Imports: External */
import bre from '@nomiclabs/buidler'
import { Contract, ContractFactory, ContractInterface, ethers } from 'ethers'

/* Imports: Internal */
import { toHexString, fromHexString } from './utils/hex-utils'

export type MockReturnValue =
  | string
  | Object
  | any[]
  | ((...params: any[]) => MockReturnValue)

export interface MockContractFunction {
  calls: string[]

  will: {
    return: {
      (): void
      with: (returnValue?: MockReturnValue) => void
    }
    revert: {
      (): void
      with: (revertValue?: string) => void
    }
    resolve: 'return' | 'revert'
    returnValue: MockReturnValue
  }
}

export interface MockContract extends Contract {
  _smockit: (
    data: Buffer
  ) => {
    resolve: 'return' | 'revert'
    returnValue: Buffer
  }
  smocked: {
    [functionName: string]: MockContractFunction
  }
}

interface SmockState {
  mocks: {
    [address: string]: MockContract
  }
  calls: {
    [address: string]: string[]
  }
  messages: any[]
}

const initSmock = (vm: any): void => {
  if (vm._smock) {
    return
  }

  vm._smock = {
    mocks: {},
    calls: {},
    messages: [],
  }

  vm.on('beforeTx', () => {
    vm._smock.calls = {}
  })

  vm.on('beforeMessage', (message: any) => {
    if (!message.to) {
      return
    }

    const target = toHexString(message.to).toLowerCase()
    if (!(target in vm._smock.mocks)) {
      return
    }

    if (!(target in vm._smock.calls)) {
      vm._smock.calls[target] = []
    }

    vm._smock.calls[target].push(message.data)
    vm._smock.messages.push(message)
  })

  vm.on('afterMessage', async (result: any) => {
    if (vm._smock.messages.length === 0) {
      return
    }

    const message = vm._smock.messages.pop()
    const target = toHexString(message.to).toLowerCase()
    const mock: MockContract = vm._smock.mocks[target]

    const { resolve, returnValue } = mock._smockit(message.data)

    if (resolve === 'revert') {
      // TODO: Handle reverts. Requires adding new logic to beforeMessage handler forcing the
      // result to be a revert, not easy.
    } else {
      result.execResult.returnValue = returnValue
    }
  })
}

const bindSmock = (mock: MockContract): void => {
  const vm = bre.network.provider['_node' as any]['_vm' as any]
  initSmock(vm)

  vm._smock.mocks[mock.address.toLowerCase()] = mock
}

const makeRandomAddress = (): string => {
  return ethers.utils.getAddress(
    '0x' +
      [...Array(40)]
        .map(() => {
          return Math.floor(Math.random() * 16).toString(16)
        })
        .join('')
  )
}

export const smockit = (
  spec: ContractInterface | Contract | ContractFactory,
  provider?: any
): MockContract => {
  const iface: ContractInterface = (spec as any).interface || spec
  const contract = new ethers.Contract(
    makeRandomAddress(),
    iface,
    provider || (spec as any).provider
  ) as MockContract

  contract.smocked = {}
  for (const functionName of Object.keys(contract.functions)) {
    contract.smocked[functionName] = {
      get calls() {
        return this._calls
      },

      will: {
        get return() {
          const fn: any = () => {
            this.resolve = 'return'
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
          }

          fn.with = (revertValue?: string): void => {
            this.resolve = 'revert'
            this.returnValue = revertValue
          }

          return fn
        },
        resolve: 'return',
        returnValue: '0x',
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
        encodedReturnValue = this.interface.encodeFunctionResult(
          fn,
          Array.isArray(rawReturnValue) ? rawReturnValue : [rawReturnValue]
        )
      } catch {
        if (typeof rawReturnValue !== 'string') {
          throw new Error(
            `Could not properly encode mock return value for ${fn.name}`
          )
        }

        encodedReturnValue = rawReturnValue
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
