import escapeRegexp from 'escape-string-regexp'
import dotProp from 'dot-prop'

import { split } from './shlex'

export type ISchema = Record<string, {
  type?: 'string' | 'number' | 'date' | 'boolean'
  isAny?: boolean
}>

export interface IQSearchResult {
  cond: any
  nonSchema: string[]
}

export default class QSearch {
  constructor (
    // eslint-disable-next-line no-unused-vars
    public options: {
      /**
       * Default to "mongodb"
       */
      dialect?: 'mongodb' | 'native' | 'liteorm'
      schema?: ISchema
      nonSchemaKeys?: string[]
      /**
       * Default to
       *
       * ```js
       * (d: any) => d ? new Date(d) : null
       * ```
       *
       * Set to `false` to set `(d: any) => d`, or non-conversion
       * or create your own, perhaps using moment.js
       */
      normalizeDates?: boolean | ((d: any) => Date | string | null)
    } = {}
  ) {}

  get dialect () {
    return this.options.dialect || 'mongo'
  }

  /**
   * Meaning case-insensitve substring
   */
  get hasSubstrSupport () {
    return ['native', 'liteorm'].includes(this.dialect)
  }

  get schema () {
    return this.options.schema || {} as ISchema
  }

  get nonSchemaKeys () {
    return new Set<string>(this.options.nonSchemaKeys || [])
  }

  normalizeDates (d: any): Date | string | null {
    const fn = this.options.normalizeDates instanceof Function
      ? this.options.normalizeDates
      : this.options.normalizeDates === false
        ? (d: any) => d
        : (d: any) => d ? new Date(d) : null
    return fn(d)
  }

  parse (q: string): IQSearchResult {
    let $or = [] as any[]
    const $and = [] as any[]
    const nonSchema = [] as string[]

    split(q).map((el) => {
      const [op] = /^[-+?]/.exec(el) || [] as string[]
      if (op) {
        el = el.substr(1)
      }

      const addOp = (k: string, opK: string, v: any) => {
        let isDate = false

        if (v && this.schema[k]) {
          if (this.schema[k].type === 'number') {
            v = parseFloat(v)
          } else if (this.schema[k].type === 'boolean') {
            if (v === 'FALSE') {
              v = false
            } else if (v === 'TRUE') {
              v = true
            } else {
              v = !!v
            }
          } else if (this.schema[k].type === 'date') {
            if (v === 'NOW') {
              v = new Date()
            } else {
              const vMillisec = (() => {
                const [, p1, p2] = /^([+-]?\d+(?:\.\d+)?)([yMwdhm])$/i.exec(v) || []
                const v0 = +new Date()
                if (p2 === 'y') {
                  return v0 + parseFloat(p1) * 365 * 24 * 60 * 60 * 1000 // 365d 24h 60m 60s 1000ms
                } else if (p2 === 'M') {
                  return v0 + parseFloat(p1) * 30 * 24 * 60 * 60 * 1000 // 30d 24h 60m 60s 1000ms
                } else if (p2 === 'w') {
                  return v0 + parseFloat(p1) * 7 * 24 * 60 * 60 * 1000 // 7d 24h 60m 60s 1000ms
                } else if (p2 === 'd') {
                  return v0 + parseFloat(p1) * 24 * 60 * 60 * 1000 // 24h 60m 60s 1000ms
                } else if (p2 === 'h') {
                  return v0 + parseFloat(p1) * 60 * 60 * 1000 // 60m 60s 1000ms
                } else if (p2 === 'm') {
                  return v0 + parseFloat(p1) * 60 * 1000 // 60s 1000ms
                }
                return null
              })()

              v = vMillisec ? new Date(vMillisec) : v
            }

            v = this.normalizeDates(v)
            isDate = true
          }
        }

        if (op === '+') {
          return { [k]: v }
        } else {
          if (typeof v === 'string' && !isDate) {
            if (this.hasSubstrSupport) {
              v = { $substr: v }
            } else {
              v = { $regex: new RegExp(escapeRegexp(v), 'i') }
            }
          } else if (opK === '>') {
            v = { $gt: v }
          } else if (opK === '<') {
            v = { $lt: v }
          }

          return op === '-'
            ? { $nor: [{ [k]: v }] }
            : { [k]: v }
        }
      }

      const [k, opK, v] = el.split(/([:><])(.+)/)
      if (this.nonSchemaKeys.has(k)) {
        nonSchema.push(el)
        return
      }

      if (v === 'NULL') {
        if (this.dialect === 'liteorm') {
          if (op === '-') {
            $and.push(
              { [k]: { $exists: true } }
            )
            return
          } else if (op === '?') {
            $or.push(
              { [k]: { $exists: false } }
            )
          } else {
            $and.push(
              { [k]: { $exists: false } }
            )
          }
        } else {
          if (op === '-') {
            $and.push(
              { [k]: { $exists: true } },
              { [k]: { $ne: null } }
            )
            return
          } else if (op === '?') {
            $or.push(
              { [k]: { $exists: false } },
              { [k]: null }
            )
          } else {
            $and.push({
              $or: [
                { [k]: { $exists: false } },
                { [k]: null }
              ]
            })
          }
        }
        return
      }

      let subCond: any = null

      if (v) {
        subCond = addOp(k, opK, v)
      } else if (this.schema) {
        subCond = {
          [op === '-' ? '$and' : '$or']: Object.entries(this.schema)
            .filter(([_, v0]) => (!v0.type || v0.type === 'string') && v0.isAny !== false)
            .map(([k0, _]) => addOp(k0, opK, k))
            .filter((c) => c)
        }
      }

      if (subCond) {
        if (op === '?') {
          $or.push(subCond)
        } else {
          $and.push(subCond)
        }
      }
    })

    $or.push($and.length > 1 ? { $and } : ($and[0] || {}))
    $or = $or.filter((el) => el)

    const cond = $or.length > 1 ? { $or } : ($or[0] || {})

    return { cond, nonSchema }
  }

  filter<T> (q: string, item: T[]): T[] {
    return item.filter((it) => this.filterFunction(this.parse(q).cond)(it))
  }

  filterFunction (cond: any) {
    return (item: Record<string, any>): boolean => {
      for (const [k, v] of Object.entries<any>(cond)) {
        if (k[0] === '$') {
          if (k === '$and') {
            return v.every((x: Record<string, any>) => this.filterFunction(x)(item))
          } else if (k === '$or') {
            return v.some((x: Record<string, any>) => this.filterFunction(x)(item))
          } else if (k === '$nor') {
            return !v.some((x: Record<string, any>) => this.filterFunction(x)(item))
          }
        } else {
          const itemK = dotProp.get<any>(item, k)

          if (v && v.constructor === {}.constructor &&
            Object.keys(v).some((k0) => k0[0] === '$')) {
            return (() => {
              for (const op of Object.keys(v)) {
                try {
                  if (op === '$regex') {
                    let cmp: RegExp

                    if (v[op] instanceof RegExp) {
                      cmp = v[op]
                    } else {
                      cmp = new RegExp(v[op].toString(), 'i')
                    }

                    const arr = Array.isArray(itemK) ? itemK : [itemK]

                    return arr.some((el) => {
                      return typeof el === 'string'
                        ? cmp.test(el)
                        : false
                    })
                  } else if (op === '$substr') {
                    const cmp = v[op].toString()
                    const arr = Array.isArray(itemK) ? itemK : [itemK]

                    return arr.some((el) => {
                      return typeof el === 'string'
                        ? el.toLocaleLowerCase()
                          .includes(cmp.toLocaleLowerCase())
                        : false
                    })
                  } else if (op === '$nsubstr') {
                    const cmp = v[op].toString()
                    const arr = Array.isArray(itemK) ? itemK : [itemK]

                    return arr.every((el) => {
                      return typeof el === 'string'
                        ? !el.toLocaleLowerCase()
                          .includes(cmp.toLocaleLowerCase())
                        : true
                    })
                  } else if (op === '$exists') {
                    return (itemK === null || itemK === undefined || itemK === '') !== v[op]
                  } else {
                    let v1 = itemK
                    let v2 = v[op]

                    let canCompare = false

                    if (typeof v1 === 'object' && typeof v2 === 'object') {
                      if (v1 && v2 && (v1 instanceof Date || v2 instanceof Date)) {
                        if (!(v1 instanceof Date)) {
                          v1 = new Date(v1)
                        }

                        if (!(v2 instanceof Date)) {
                          v2 = new Date(v2)
                        }

                        canCompare = true
                      }
                    } else {
                      canCompare = (typeof v1 === typeof v2)
                    }

                    if (op === '$ne') {
                      return v1 !== v2
                    }

                    if (canCompare) {
                      if (op === '$gte') {
                        return v1 >= v2
                      } else if (op === '$gt') {
                        return v1 > v2
                      } else if (op === '$lte') {
                        return v1 <= v2
                      } else if (op === '$lt') {
                        return v1 < v2
                      }
                    }
                  }
                } catch (e) { }
              }
              return false
            })()
          } else if (Array.isArray(itemK)) {
            if (!itemK.includes(v)) {
              return false
            }
          } else if (itemK !== v) {
            return false
          }
        }
      }

      return true
    }
  }
}
