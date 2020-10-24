/* Imports: External */
import { Contract } from 'ethers'

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
