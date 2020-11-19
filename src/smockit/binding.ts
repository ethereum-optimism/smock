/* Imports: External */
import bre from 'hardhat'
import { TransactionExecutionError } from 'hardhat/internal/hardhat-network/provider/errors'

/* Imports: Internal */
import { MockContract } from './types'
import { toHexString } from '../utils'

class VmError {
  error: string
  errorType: string

  constructor(error: string) {
    this.error = error
    this.errorType = 'VmError'
  }
}

const initSmock = (vm: any): void => {
  if (vm._smock) {
    return
  }

  vm._smock = {
    mocks: {},
    calls: {},
    messages: [],
    shouldReturnCode: false,
  }

  vm.on('beforeTx', () => {
    vm._smock.calls = {}
  })

  vm.on('beforeMessage', (message: any) => {
    if (!message.to) {
      return
    }

    const target = toHexString(message.to).toLowerCase()
    if (!(target in vm._smock.mocks)) {
      return
    }

    if (!(target in vm._smock.calls)) {
      vm._smock.calls[target] = []
    }

    vm._smock.calls[target].push(message.data)
    vm._smock.messages.push(message)

    // Return the real (empty) while in the message context.
    vm._smock.shouldReturnCode = true
  })

  vm.on('afterMessage', async (result: any) => {
    if (result && result.createdAddress) {
      const created = toHexString(result.createdAddress).toLowerCase()
      if (created in vm._smock.mocks) {
        delete vm._smock.mocks[created]
      }
    }

    if (vm._smock.messages.length === 0) {
      return
    }

    const message = vm._smock.messages.pop()
    const target = toHexString(message.to).toLowerCase()

    if (!(target in vm._smock.mocks)) {
      return
    }

    const mock: MockContract = vm._smock.mocks[target]

    const { resolve, returnValue } = mock._smockit(message.data)

    result.execResult.returnValue = returnValue
    if (resolve === 'revert') {
      result.execResult.exceptionError = new VmError('smocked revert')
    }
  })

  vm.on('step', () => {
    // Return the fake (non-empty) while in the interpreter context.
    vm._smock.shouldReturnCode = false
  })

  const originalGetContractCodeFn = vm.pStateManager.getContractCode.bind(
    vm.pStateManager
  )
  vm.pStateManager.getContractCode = async (
    addressBuf: Buffer
  ): Promise<Buffer> => {
    const address = toHexString(addressBuf).toLowerCase()
    if (address in vm._smock.mocks && vm._smock.shouldReturnCode === false) {
      return Buffer.from('F3', 'hex')
    } else {
      return originalGetContractCodeFn(addressBuf)
    }
  }

  const provider =
    bre.network.provider['_wrapped' as any]['_wrapped' as any][
      '_wrapped' as any
    ]['_wrapped' as any]
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

export const bindSmock = (mock: MockContract): void => {
  const provider =
    bre.network.provider['_wrapped' as any]['_wrapped' as any][
      '_wrapped' as any
    ]['_wrapped' as any]
  const vm = provider['_node' as any]['_vm' as any]
  initSmock(vm)

  vm._smock.mocks[mock.address.toLowerCase()] = mock
}
