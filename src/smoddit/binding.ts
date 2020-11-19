/* External Imports */
import bre from 'hardhat'

/* Internal Imports */
import { ModifiableContract } from './types'
import { toHexString, fromHexString } from '../utils'

/**
 * Initializes smodding functionality.
 * @param vm ethereumjs-vm VM instance.
 */
const initSmod = (vm: any): void => {
  if (vm._smod) {
    return
  }

  vm._smod = {
    contracts: {},
  }

  const pStateManager = vm.pStateManager

  const originalGetStorageFn = pStateManager.getContractStorage.bind(
    pStateManager
  )
  pStateManager.getContractStorage = async (
    addressBuf: Buffer,
    keyBuf: Buffer
  ): Promise<Buffer> => {
    const originalReturnValue = await originalGetStorageFn(addressBuf, keyBuf)

    const address = toHexString(addressBuf).toLowerCase()
    const key = toHexString(keyBuf).toLowerCase()

    if (!(address in vm._smod.contracts)) {
      return originalReturnValue
    }

    const contract: ModifiableContract = vm._smod.contracts[address]
    if (!(key in contract._smodded)) {
      return originalReturnValue
    }

    return fromHexString(contract._smodded[key])
  }

  const originalPutStorageFn = pStateManager.putContractStorage.bind(
    pStateManager
  )
  pStateManager.putContractStorage = async (
    addressBuf: Buffer,
    keyBuf: Buffer,
    valBuf: Buffer
  ): Promise<void> => {
    await originalPutStorageFn(addressBuf, keyBuf, valBuf)

    const address = toHexString(addressBuf).toLowerCase()
    const key = toHexString(keyBuf).toLowerCase()

    if (!(address in vm._smod.contracts)) {
      return
    }

    const contract: ModifiableContract = vm._smod.contracts[address]
    if (!(key in contract._smodded)) {
      return
    }

    delete contract._smodded[key]
  }
}

/**
 * Binds the smodded contract to the VM.
 * @param contract Contract to bind.
 */
export const bindSmod = (contract: ModifiableContract): void => {
  const provider =
    bre.network.provider['_wrapped' as any]['_wrapped' as any][
      '_wrapped' as any
    ]['_wrapped' as any]
  const vm = provider['_node' as any]['_vm' as any]
  initSmod(vm)

  vm._smod.contracts[contract.address.toLowerCase()] = contract
}
