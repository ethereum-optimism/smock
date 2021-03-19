/* Imports: External */
import bre from 'hardhat'
import { TransactionExecutionError } from 'hardhat/internal/hardhat-network/provider/errors'
import { HardhatNetworkProvider } from 'hardhat/internal/hardhat-network/provider/provider'

/* Imports: Internal */
import { MockContract, VmError } from './types'
import { toHexString } from '../utils'

const isSmockInitialized = (provider: any): boolean => {
  return (provider as any)._node._vm._smockState !== undefined
}

const initializeSmock = (provider: HardhatNetworkProvider): void => {
  if (isSmockInitialized(provider)) {
    return
  }

  const vm = (provider as any)._node._vm

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

  const originalGetContractCodeFn = vm.pStateManager.getContractCode.bind(
    vm.pStateManager
  )
  vm.pStateManager.getContractCode = async (
    addressBuf: Buffer
  ): Promise<Buffer> => {
    const address = toHexString(addressBuf).toLowerCase()
    if (
      address in vm._smockState.mocks &&
      vm._smockState.shouldReturnCode === false
    ) {
      return Buffer.from('F3', 'hex')
    } else {
      return originalGetContractCodeFn(addressBuf)
    }
  }

  const buidlerNode = provider['_node' as any]
  const originalManagerErrorsFn = buidlerNode['_manageErrors' as any].bind(
    buidlerNode
  )
  buidlerNode['_manageErrors' as any] = async (
    vmResult: any,
    vmTrace: any,
    vmTracerError?: any
  ): Promise<any> => {
    if (
      vmResult.exceptionError &&
      vmResult.exceptionError.error === 'smocked revert'
    ) {
      throw new TransactionExecutionError('Transaction failed: revert')
    } else {
      return originalManagerErrorsFn(vmResult, vmTrace, vmTracerError)
    }
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
