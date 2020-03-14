import crypto from 'crypto'

import { Serialize } from 'any-serialize'

export const ser = new Serialize()

export function hash (obj: any) {
  const hash = crypto.createHash('sha256')

  if (obj instanceof ArrayBuffer) {
    return hash.update(Buffer.from(obj)).digest('base64')
  } else {
    return hash.update(ser.stringify(obj)).digest('base64')
  }
}
