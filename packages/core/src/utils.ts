import crypto from 'crypto'

import { Serialize } from 'any-serialize'
import dayjs from 'dayjs'

export const ser = new Serialize()

export function hash (obj: any) {
  const hash = crypto.createHash('sha256')

  if (obj instanceof ArrayBuffer) {
    return hash.update(Buffer.from(obj)).digest('base64')
  } else if (typeof obj === 'object') {
    return hash.update(ser.stringify(obj)).digest('base64')
  } else {
    return obj
  }
}

export function toDate (d: string) {
  if (typeof d !== 'string' || !d.trim()) {
    throw new Error('You must supply non-empty string')
  }

  const djs = dayjs(d)
  if (!djs.isValid()) {
    throw new Error(`Invalid Date: ${d}`)
  }

  return djs.toDate()
}
