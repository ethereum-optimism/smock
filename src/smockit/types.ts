/* Imports: External */
import { Contract, ContractFactory, ethers } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'
import { JsonFragment, Fragment } from '@ethersproject/abi'

export type SmockSpec =
  | Contract
  | ContractFactory
  | ethers.utils.Interface
  | string
  | (JsonFragment | Fragment | string)[]

export interface SmockOptions {
  provider?: Provider
  address?: string
}

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
  }
}

export type MockContract = Contract & {
  smocked: {
    [name: string]: MockContractFunction
  }
}

export class VmError {
  error: string
  errorType: string

  constructor(error: string) {
    this.error = error
    this.errorType = 'VmError'
  }
}
