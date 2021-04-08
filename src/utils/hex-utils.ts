/* External Imports */
import { BigNumber } from 'ethers'
import { remove0x } from '@eth-optimism/core-utils'

export const toHexString32 = (
  value: string | number | BigNumber | boolean
): string => {
  if (typeof value === 'string' && value.startsWith('0x')) {
    return '0x' + remove0x(value).padEnd(64, '0').toLowerCase()
  } else if (typeof value === 'boolean') {
    return '0x' + `${value ? 1 : 0}`.padStart(64, '0')
  } else {
    return (
      '0x' +
      remove0x(BigNumber.from(value).toHexString())
        .padStart(64, '0')
        .toLowerCase()
    )
  }
}
