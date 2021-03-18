/* Imports: External */
import { Contract, ContractFactory, ContractInterface } from 'ethers'

export type SmockSpec =
  | ContractInterface
  | Contract
  | ContractFactory
  | string
  | any

export interface SmockOptions {
  provider?: any // What's the right type for a generic ethers provider?
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
