/* Imports: External */
import { Artifact } from 'hardhat/types'
import { Contract, ContractFactory, ethers } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'
import { JsonFragment, Fragment } from '@ethersproject/abi'

export type SmockSpec =
  | Artifact
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

  reset: () => void

  will: {
    return: {
      (): void
      with: (returnValue?: MockReturnValue) => void
    }
    revert: {
      (): void
      with: (
        revertValue?: string | (() => string) | (() => Promise<string>)
      ) => void
    }
    resolve: 'return' | 'revert'
  }
}

export type MockContract = Contract & {
  smocked: {
    [name: string]: MockContractFunction
  }
}

export interface SmockedVM {
  _smockState: {
    mocks: {
      [address: string]: MockContract
    }
    calls: {
      [address: string]: any[]
    }
    messages: any[]
  }

  on: (event: string, callback: Function) => void

  pStateManager: {
    putContractCode: (address: Buffer, code: Buffer) => Promise<void>
  }
}

const isMockFunction = (obj: any): obj is MockContractFunction => {
  return (
    obj &&
    obj.will &&
    obj.will.return &&
    obj.will.return.with &&
    obj.will.revert &&
    obj.will.revert.with
    // TODO: obj.will.emit
  )
}

export const isMockContract = (obj: any): obj is MockContract => {
  return (
    obj &&
    obj.smocked &&
    obj.smocked.fallback &&
    Object.values(obj.smocked).every((smockFunction: any) => {
      return isMockFunction(smockFunction)
    })
  )
}

export const isArtifact = (obj: any): obj is Artifact => {
  return (
    obj &&
    typeof obj._format === 'string' &&
    typeof obj.contractName === 'string' &&
    typeof obj.sourceName === 'string' &&
    Array.isArray(obj.abi) &&
    typeof obj.bytecode === 'string' &&
    typeof obj.deployedBytecode === 'string' &&
    obj.linkReferences &&
    obj.deployedLinkReferences
  )
}
