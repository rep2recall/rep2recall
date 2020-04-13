import crypto from 'crypto'

import { Serialize } from 'any-serialize'

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

export async function mapAsync<T, R = T> (
  arr: T[],
  cb: (el: T, i: number, a0: T[]) => Promise<R>
): Promise<R[]> {
  return Promise.all(arr.map(async (el, i, a0) => {
    return await cb(el, i, a0)
  }))
}

export function distinctBy<T> (arr: T[], k: string, undefinedIsDistinct?: boolean): T[] {
  const arrK = arr.map((a) => hash((a as any)[k]))
  return arr.filter((a, i) => {
    const aK = (a as any)[k]
    if (aK === undefined) {
      return !!undefinedIsDistinct
    } else {
      return arrK.indexOf(hash(aK)) === i
    }
  })
}

export function * chunk<T> (arr: T[], n: number) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
export function shuffle<T> (a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
