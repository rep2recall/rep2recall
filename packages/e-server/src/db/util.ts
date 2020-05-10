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

export function removeNull (a: any) {
  return JSON.parse(JSON.stringify(a, function (_, v) {
    if (!v && typeof v === 'object') {
      return undefined
    }
    return v
  }))
}

export async function mapAsync<T, R = T> (
  arr: T[],
  cb: (el: T, i: number, a0: T[]) => Promise<R>
): Promise<R[]> {
  return Promise.all(arr.map(async (el, i, a0) => {
    return await cb(el, i, a0)
  }))
}

export function * chunks<T> (arr: T[], n: number) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

export function deepMerge (dst: any, src: any) {
  if (dst && typeof dst === 'object') {
    if (src && typeof src === 'object') {
      const out: any = {}
      Array.from(new Set([...Object.keys(dst), ...Object.keys(src)])).map((k) => {
        out[k] = deepMerge(dst[k], src[k])
      })

      return out
    }
  }

  return typeof dst === 'undefined' ? src : dst
}
