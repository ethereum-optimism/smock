/* External Imports */
import bre, { ethers } from '@nomiclabs/buidler'
import { readArtifact } from '@nomiclabs/buidler/internal/artifacts'
import { Contract, ContractFactory, BigNumber } from 'ethers'
import { keccak256 } from 'ethers/lib/utils'
import _ from 'lodash'

/* Internal Imports */
import { remove0x, toHexString, fromHexString, toHexString32 } from './utils'

interface InputSlot {
  label: string
  slot: number
}

interface StorageSlot {
  label: string
  hash: string
  value: string
}

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

/**
 * Flattens an object.
 * @param obj Object to flatten.
 * @param prefix Current object prefix (used recursively).
 * @param res Current result (used recursively).
 * @returns Flattened object.
 */
const flattenObject = (
  obj: any,
  prefix: string = '',
  res: any = {}
): Object => {
  if (BigNumber.isBigNumber(obj)) {
    res[prefix] = obj.toNumber()
    return res
  } else if (_.isString(obj) || _.isNumber(obj) || _.isBoolean(obj)) {
    res[prefix] = obj
    return res
  } else if (_.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const pre = _.isEmpty(prefix) ? `${i}` : `${prefix}.${i}`
      flattenObject(obj[i], pre, res)
    }
    return res
  } else if (_.isPlainObject(obj)) {
    for (const key of Object.keys(obj)) {
      const pre = _.isEmpty(prefix) ? key : `${prefix}.${key}`
      flattenObject(obj[key], pre, res)
    }
    return res
  } else {
    throw new Error('Cannot flatten unsupported object type.')
  }
}

/**
 * Gets the slot positions for a provided variable type.
 * @param storageLayout Contract's storage layout.
 * @param inputTypeName Variable type name.
 * @returns Slot positions.
 */
const getInputSlots = (
  storageLayout: any,
  inputTypeName: string
): InputSlot[] => {
  const inputType = storageLayout.types[inputTypeName]

  if (inputType.encoding === 'mapping') {
    return getInputSlots(storageLayout, inputType.value)
  } else if (inputType.encoding === 'inplace') {
    if (inputType.members) {
      return inputType.members.map((member: any) => {
        return {
          label: member.label,
          slot: member.slot,
        }
      })
    } else {
      return [
        {
          label: 'default',
          slot: 0,
        },
      ]
    }
  } else {
    throw new Error(`Encoding type not supported: ${inputType.encoding}`)
  }
}

/**
 * Converts storage into a list of storage slots.
 * @param storageLayout Contract storage layout.
 * @param obj Storage object to convert.
 * @returns List of storage slots.
 */
const getStorageSlots = (storageLayout: any, obj: any): StorageSlot[] => {
  const slots: StorageSlot[] = []
  const flat = flattenObject(obj)

  for (const key of Object.keys(flat)) {
    const path = key.split('.')
    const variableLabel = path[0]

    const variableDef = storageLayout.storage.find((vDef: any) => {
      return vDef.label === variableLabel
    })

    if (!variableDef) {
      throw new Error(
        `Could not find a matching variable definition for ${variableLabel}`
      )
    }

    const baseSlot = parseInt(variableDef.slot, 10)
    const baseDepth = (variableDef.type.match(/t_mapping/g) || []).length
    const slotLabel =
      path.length > 1 + baseDepth ? path[path.length - 1] : 'default'

    const inputSlot = getInputSlots(storageLayout, variableDef.type).find(
      (iSlot) => {
        return iSlot.label === slotLabel
      }
    )

    if (!inputSlot) {
      throw new Error(
        `Could not find a matching slot definition for ${slotLabel}`
      )
    }

    let slotHash = toHexString32(baseSlot)
    for (let i = 0; i < baseDepth; i++) {
      slotHash = keccak256(toHexString32(path[i + 1]) + remove0x(slotHash))
    }

    slotHash = toHexString32(BigNumber.from(slotHash).add(inputSlot.slot))

    slots.push({
      label: key,
      hash: slotHash,
      value: toHexString32(flat[key]),
    })
  }

  return slots
}

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
  ): Promise<any> => {
    const originalReturnValue = originalGetStorageFn(addressBuf, keyBuf)
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
}

/**
 * Binds the smodded contract to the VM.
 * @param contract Contract to bind.
 */
const bindSmod = (contract: ModifiableContract): void => {
  const vm = bre.network.provider['_node' as any]['_vm' as any]
  initSmod(vm)

  vm._smod.contracts[contract.address.toLowerCase()] = contract
}

/**
 * Reads the storage layout of a contract.
 * @param name Name of the contract to get a storage layout for.
 * @return Storage layout for the given contract name.
 */
const getStorageLayout = async (name: string): Promise<any> => {
  return ((await readArtifact(bre.config.paths.artifacts, name)) as any)
    .storageLayout
}

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

  const pStateManager = bre.network.provider['_node' as any]['_vm' as any].pStateManager
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
          return
        }

        const slots = getStorageSlots(layout, storage)
        return slots.every(async (slot) => {
          return toHexString32(await pStateManager.getContractStorage(
            fromHexString(this.address),
            fromHexString(slot.hash.toLowerCase())
          )) === slot.value
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
