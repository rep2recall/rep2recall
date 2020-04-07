import { Serialize } from 'any-serialize'

export const ser = new Serialize()

export function normalizeArray<T> (a: T | T[]): T | undefined {
  if (Array.isArray(a)) {
    return a[0]
  }
  return a
}

export function nullify (a: any) {
  let isNull = false

  if (a && typeof a === 'object') {
    if (Array.isArray(a)) {
      isNull = !a.length
    } else {
      isNull = !Object.keys(a).length
    }
  } else if (typeof a !== 'number') {
    isNull = !a
  }

  return isNull ? undefined : a
}

export function nullifyObject (a: Record<string, any>) {
  return ser.clone(Object.entries(a)
    .map(([k, v]) => [k, nullify(v)])
    .filter(([_, v]) => typeof v !== 'undefined')
    .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {} as any),
  )
}

export function stringSorter (arr: string[]) {
  return arr.sort((a, b) => {
    return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())
  })
}

export function deepMerge (dst: any, src: any) {
  if (isPlainObject(dst) && isPlainObject(src)) {
    Object.entries(src).map(([k, v]) => {
      dst[k] = deepMerge(dst[k], v)
    })
    return dst
  } else if (Array.isArray(dst) && Array.isArray(src)) {
    src.map((v, i) => {
      dst[i] = deepMerge(dst[i], v)
    })
    return dst
  } else if (dst !== undefined) {
    return dst
  }

  return src
}

export function isPlainObject (a: any): boolean {
  return !!a && typeof a === 'object' && a.constructor === Object
}
