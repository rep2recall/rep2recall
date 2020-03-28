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
