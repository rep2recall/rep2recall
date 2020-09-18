import { Serialize } from 'any-serialize'

export const ser = new Serialize()

export function filterObjValue (obj: unknown, fn: (v: unknown) => boolean): unknown {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.filter((a) => fn(a)).map((a) => filterObjValue(a, fn))
    } else {
      return Object.entries(obj)
        .filter(([, v]) => fn(v))
        .map(([k, v]) => [k, filterObjValue(v, fn)])
        .reduce((prev, [k, v]) => ({ ...prev, [k as string]: v }), {})
    }
  }

  return obj
}
