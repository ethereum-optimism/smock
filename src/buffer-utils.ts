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
