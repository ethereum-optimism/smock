/* External Imports */
import bre, { ethers } from 'hardhat'
import { fromHexString } from '@eth-optimism/core-utils'

/* Internal Imports */
import { ModifiableContract, ModifiableContractFactory } from './types'
import { getStorageLayout, getStorageSlots } from './storage'
import { bindSmod } from './binding'
import { toHexString32 } from '../utils'

/**
 * Creates a modifiable contract factory.
 * @param name Name of the contract to smoddify.
 * @param signer Optional signer to attach to the factory.
 * @returns Smoddified contract factory.
 */
export const smoddit = async (
  name: string,
  signer?: any
): Promise<ModifiableContractFactory> => {
  const factory = (await ethers.getContractFactory(
    name,
    signer
  )) as ModifiableContractFactory
  const layout = await getStorageLayout(name)

  const provider =
    bre.network.provider['_wrapped' as any]['_wrapped' as any][
    '_wrapped' as any
    ]['_wrapped' as any]
  const pStateManager = provider['_node' as any]['_vm' as any].pStateManager
  const originalDeployFn = factory.deploy.bind(factory)
  factory.deploy = async (...args: any[]): Promise<ModifiableContract> => {
    const contract: ModifiableContract = await originalDeployFn(...args)
    contract._smodded = {}
    contract.smodify = {
      put: function (storage: any) {
        if (!storage) {
          return
        }

        const slots = getStorageSlots(layout, storage)
        for (const slot of slots) {
          contract._smodded[slot.hash.toLowerCase()] = slot.value
        }
      },
      set: function (storage: any) {
        this.reset()
        this.put(storage)
      },
      check: async function (storage: any) {
        if (!storage) {
          return true
        }

        const slots = getStorageSlots(layout, storage)
        return slots.every(async (slot) => {
          return (
            toHexString32(
              await pStateManager.getContractStorage(
                fromHexString(contract.address),
                fromHexString(slot.hash.toLowerCase())
              )
            ) === slot.value
          )
        })
      },
      reset: function () {
        contract._smodded = {}
      },
    }

    bindSmod(contract)
    return contract
  }

  return factory
}
