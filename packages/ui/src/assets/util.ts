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
    .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {} as any)
  )
}

export function stringSorter (arr: string[]) {
  return arr.sort((a, b) => {
    return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())
  })
}

export function deepMerge (dst: any, src: any = {}) {
  if (dst && src && typeof dst === 'object' && typeof src === 'object') {
    const objIfy = (el: any) => {
      const repl = {} as any

      if (Array.isArray(el)) {
        el.map((k) => { repl[k] = null })
      } else {
        Object.entries(el).map(([k, v]) => { repl[k] = v })
      }

      return repl
    }

    const repl = objIfy(dst)

    Object.entries(objIfy(src)).map(([k, v]) => {
      repl[k] = deepMerge(repl[k], v)
    })

    if (Object.values(dst).every((v) => v === null)) {
      dst = Object.keys(dst).sort()
    }

    return dst
  } else if (dst !== undefined) {
    return dst
  }

  return src
}
