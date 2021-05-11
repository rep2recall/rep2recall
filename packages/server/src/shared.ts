import { Magic } from '@magic-sdk/admin'
import { Serialize } from 'any-serialize'

export const ser = new Serialize()

export const magic = process.env.MAGIC_SECRET
  ? new Magic(process.env.MAGIC_SECRET)
  : null
