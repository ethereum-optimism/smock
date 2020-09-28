/* External Imports */
import { BigNumber } from 'ethers'

export const add0x = (str: string): string => {
  return str.startsWith('0x') ? str : '0x' + str
}

export const remove0x = (str: string): string => {
  return str.startsWith('0x') ? str.slice(2) : str
}

export const toHexString = (buf: Buffer): string => {
  return add0x(buf.toString('hex'))
}

export const fromHexString = (str: string): Buffer => {
  return Buffer.from(remove0x(str), 'hex')
}

export const toHexString32 = (
  value: string | number | BigNumber | boolean
): string => {
  if (typeof value === 'string' && value.startsWith('0x')) {
    return '0x' + remove0x(value).padStart(64, '0').toLowerCase()
  } else if (typeof value === 'boolean') {
    return toHexString32(value ? 1 : 0)
  } else {
    return toHexString32(BigNumber.from(value).toHexString())
  }
}
