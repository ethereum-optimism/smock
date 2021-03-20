/* Imports: External */
import { TransactionExecutionError } from 'hardhat/internal/hardhat-network/provider/errors'
import { HardhatNetworkProvider } from 'hardhat/internal/hardhat-network/provider/provider'

/* Imports: Internal */
import { MockContract, VmError } from './types'
import { toHexString } from '../utils'

/**
 * Checks to see if smock has been initialized already. Basically just checking to see if we've
 * attached smock state to the VM already.
 * @param provider Base hardhat network provider to check.
 * @return Whether or not the provider has already been modified to support smock.
 */
const isSmockInitialized = (provider: HardhatNetworkProvider): boolean => {
  return (provider as any)._node._vm._smockState !== undefined
}

const initializeSmock = (provider: HardhatNetworkProvider): void => {
  if (isSmockInitialized(provider)) {
    return
  }

  const node = (provider as any)._node
  const vm = node._vm
  const pStateManager = vm.pStateManager

  vm._smockState = {
    mocks: {},
    calls: {},
    messages: [],
    shouldReturnCode: false,
  }

  vm.on('beforeTx', () => {
    vm._smockState.calls = {}
  })

  vm.on('beforeMessage', (message: any) => {
    if (!message.to) {
      return
    }

    const target = toHexString(message.to).toLowerCase()
    if (!(target in vm._smockState.mocks)) {
      return
    }

    if (!(target in vm._smockState.calls)) {
      vm._smockState.calls[target] = []
    }

    vm._smockState.calls[target].push(message.data)
    vm._smockState.messages.push(message)

    // Return the real (empty) while in the message context.
    vm._smockState.shouldReturnCode = true
  })

  vm.on('afterMessage', async (result: any) => {
    if (result && result.createdAddress) {
      const created = toHexString(result.createdAddress).toLowerCase()
      if (created in vm._smockState.mocks) {
        delete vm._smockState.mocks[created]
      }
    }

    if (vm._smockState.messages.length === 0) {
      return
    }

    const message = vm._smockState.messages.pop()
    const target = toHexString(message.to).toLowerCase()

    if (!(target in vm._smockState.mocks)) {
      return
    }

    const mock: MockContract = vm._smockState.mocks[target]

    const { resolve, returnValue } = mock._smockit(message.data)

    result.execResult.returnValue = returnValue
    if (resolve === 'revert') {
      result.execResult.exceptionError = new VmError('smocked revert')
    }
  })

  vm.on('step', () => {
    // Return the fake (non-empty) while in the interpreter context.
    vm._smockState.shouldReturnCode = false
  })

  const originalGetContractCodeFn = pStateManager.getContractCode.bind(
    pStateManager
  )
  pStateManager.getContractCode = async (address: Buffer): Promise<Buffer> => {
    if (
      toHexString(address).toLowerCase() in vm._smockState.mocks &&
      vm._smockState.shouldReturnCode === false
    ) {
      return Buffer.from('00', 'hex') // 0x00 == STOP
    }

    return originalGetContractCodeFn(address)
  }

  // Here we're fixing with hardhat's internal error management. Smock is a bit weird and messes
  // with stack traces so we need to help hardhat out a bit when it comes to smock-specific
  // errors.
  const originalManagerErrorsFn = node._manageErrors.bind(node)
  node._manageErrors = async (
    vmResult: any,
    vmTrace: any,
    vmTracerError?: any
  ): Promise<any> => {
    if (
      vmResult.exceptionError &&
      vmResult.exceptionError.error === 'smocked revert'
    ) {
      throw new TransactionExecutionError('Transaction failed: revert')
    }

    return originalManagerErrorsFn(vmResult, vmTrace, vmTracerError)
  }
}

export const bindSmock = (
  mock: MockContract,
  provider: HardhatNetworkProvider
): void => {
  if (!isSmockInitialized(provider)) {
    initializeSmock(provider)
  }

  const vm = (provider as any)._node._vm
  vm._smockState.mocks[mock.address.toLowerCase()] = mock
}
