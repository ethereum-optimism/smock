/* External Imports */
import { Contract, ContractFactory } from 'ethers'

export interface ModifiableContract extends Contract {
  smodify: {
    put: (storage: any) => void
    set: (storage: any) => void
    check: (storage: any) => Promise<boolean>
    reset: () => void
  }

  _smodded: {
    [hash: string]: string
  }
}

export interface ModifiableContractFactory extends ContractFactory {
  deploy: (...args: any[]) => Promise<ModifiableContract>
}
