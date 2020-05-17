import { split } from './shlex'

/**
 * https://www.sqlite.org/lang_keywords.html
 * @param s identifier
 */
export function safeColumnName (s: string) {
  const keywords = `
    ABORT
    ACTION
    ADD
    AFTER
    ALL
    ALTER
    ALWAYS
    ANALYZE
    AND
    AS
    ASC
    ATTACH
    AUTOINCREMENT
    BEFORE
    BEGIN
    BETWEEN
    BY
    CASCADE
    CASE
    CAST
    CHECK
    COLLATE
    COLUMN
    COMMIT
    CONFLICT
    CONSTRAINT
    CREATE
    CROSS
    CURRENT
    CURRENT_DATE
    CURRENT_TIME
    CURRENT_TIMESTAMP
    DATABASE
    DEFAULT
    DEFERRABLE
    DEFERRED
    DELETE
    DESC
    DETACH
    DISTINCT
    DO
    DROP
    EACH
    ELSE
    END
    ESCAPE
    EXCEPT
    EXCLUDE
    EXCLUSIVE
    EXISTS
    EXPLAIN
    FAIL
    FILTER
    FIRST
    FOLLOWING
    FOR
    FOREIGN
    FROM
    FULL
    GENERATED
    GLOB
    GROUP
    GROUPS
    HAVING
    IF
    IGNORE
    IMMEDIATE
    IN
    INDEX
    INDEXED
    INITIALLY
    INNER
    INSERT
    INSTEAD
    INTERSECT
    INTO
    IS
    ISNULL
    JOIN
    KEY
    LAST
    LEFT
    LIKE
    LIMIT
    MATCH
    NATURAL
    NO
    NOT
    NOTHING
    NOTNULL
    NULL
    NULLS
    OF
    OFFSET
    ON
    OR
    ORDER
    OTHERS
    OUTER
    OVER
    PARTITION
    PLAN
    PRAGMA
    PRECEDING
    PRIMARY
    QUERY
    RAISE
    RANGE
    RECURSIVE
    REFERENCES
    REGEXP
    REINDEX
    RELEASE
    RENAME
    REPLACE
    RESTRICT
    RIGHT
    ROLLBACK
    ROW
    ROWS
    SAVEPOINT
    SELECT
    SET
    TABLE
    TEMP
    TEMPORARY
    THEN
    TIES
    TO
    TRANSACTION
    TRIGGER
    UNBOUNDED
    UNION
    UNIQUE
    UPDATE
    USING
    VACUUM
    VALUES
    VIEW
    VIRTUAL
    WHEN
    WHERE
    WINDOW
    WITH
    WITHOUT`
    .split('\n')
    .map((el) => el.trim())
    .filter((el) => el)

  /**
   * https://stackoverflow.com/questions/31788990/sqlite-what-are-the-restricted-characters-for-identifiers
   */
  const validIdToken = 'A-Z0-9_$:'
  const kwRegex = new RegExp(`(^|[^${validIdToken}\\)])(${keywords.join('|')})($|[^${validIdToken}\\()])`, 'gi')

  return s.replace(kwRegex, (_, p1, p2, p3) => {
    return `${p1}"${p2.replace(/"/g, '["]')}"${p3}`
  })
}

export class SQLParams {
  data: Record<string, any> = {}
  counter = 0

  add (v: any) {
    if (Object.keys(this.data).length >= 1000) {
      throw new Error('SQLITE_LIMIT_VARIABLE_NUMBER exceeded. (default value: 999)')
    }

    let k = '$' + ++this.counter
    while (this.data[k]) {
      k = '$' + ++this.counter
    }

    this.data[k] = v
    return k
  }
}

export class QSearch {
  params!: SQLParams
  fields!: Set<string>

  constructor (public opts: {
    anyOf: string[]
    schema: Record<string, {
      type: string
    }>
  }) {}

  parse (...qs: (string | Record<string, any>)[]): {
    where: string
    param: SQLParams
    fields: Set<string>
  } {
    this.params = new SQLParams()
    this.fields = new Set()

    return {
      where: qs
        .map((q) => typeof q === 'string' ? this._parseQ(q) : this._parseCond(q))
        .map((el) => `(${el})`)
        .join(' AND '),
      param: this.params,
      fields: this.fields
    }
  }

  _parseQ (q: string) {
    const $or = [] as string[]
    const $and = [] as string[]

    split(q).map((el) => {
      const [op] = /^[-+?]/.exec(el) || [] as string[]
      if (op) {
        el = el.substr(1)
      }

      const addOp = (k: string, opK: string, v: any) => {
        let isDate = false

        if (v && this.opts.schema[k]) {
          if (!this.opts.schema[k].type || this.opts.schema[k].type === 'string') {
            ;
          } else if (this.opts.schema[k].type === 'number') {
            ;
          } else if (this.opts.schema[k].type === 'boolean') {
            ;
          } else if (this.opts.schema[k].type === 'date') {
            if (v === 'NOW') {
              v = new Date().toISOString()
            } else {
              const vMillisec = (() => {
                const [, p1, p2] = /^([+-]?\d+(?:\.\d+)?)([yMwdhm])$/i.exec(v) || []
                const v0 = new Date().toISOString()
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

              v = vMillisec ? new Date(vMillisec).toISOString() : v
            }

            isDate = true
          }
        }

        if (op === '+') {
          return `${this.fields.add(k)} = ${this.params.add(v)}`
        } else if (op === '-') {
          if (typeof v === 'string' && !isDate) {
            return `${this.fields.add(k)} NOT LIKE '%'||${this.params.add(v)}||'%'`
          } else if (opK === '>' && (typeof v === 'number' || isDate)) {
            return `${this.fields.add(k)} <= ${this.params.add(v)}`
          } else if (opK === '<' && (typeof v === 'number' || isDate)) {
            return `${this.fields.add(k)} >= ${this.params.add(v)}`
          } else {
            return `${this.fields.add(k)} != ${this.params.add(v)}`
          }
        } else {
          if (typeof v === 'string' && !isDate) {
            return `${this.fields.add(k)} LIKE '%'||${this.params.add(v)}||'%'`
          } else if (opK === '>' && (typeof v === 'number' || isDate)) {
            return `${this.fields.add(k)} > ${this.params.add(v)}`
          } else if (opK === '<' && (typeof v === 'number' || isDate)) {
            return `${this.fields.add(k)} < ${this.params.add(v)}`
          }

          return `${this.fields.add(k)} = ${this.params.add(v)}`
        }
      }

      const [k, opK, v] = el.split(/([:><])(.+)/)

      if (v === 'NULL') {
        if (op === '-') {
          $and.push(
            `${this.fields.add(k)} IS NOT NULL`
          )
          return
        } else if (op === '?') {
          $or.push(
            `${this.fields.add(k)} IS NULL`
          )
        } else {
          $and.push(
            `${this.fields.add(k)} IS NULL`
          )
        }
        return
      }

      let subCond = ''

      if (v) {
        subCond = addOp(k, opK, v)
      } else if (this.opts.schema) {
        subCond = this.opts.anyOf
          .map((k0) => addOp(k0, opK, k))
          .join(op === '-' ? ' AND ' : ' OR ')
      }

      if (subCond) {
        if (op === '?') {
          $or.push(subCond)
        } else {
          $and.push(subCond)
        }
      }
    })

    $or.push($and.filter((el) => el).map((el) => `(${el})`).join(' AND '))

    return $or.filter((el) => el).map((el) => `(${el})`).join(' OR ') || 'TRUE'
  }

  _parseCond (q: Record<string, any>) {
    const parseCond = (q: any) => {
      const subClause: string[] = []

      if (Array.isArray(q.$or)) {
        subClause.push(q.$or.map((el: any) => parseCond(el))
          .filter((el: string) => el).map((el: string) => `(${el})`).join(' OR '))
      } else if (Array.isArray(q.$and)) {
        subClause.push(q.$and.map((el: any) => parseCond(el))
          .filter((el: string) => el).map((el: string) => `(${el})`).join(' AND '))
      } else {
        subClause.push(parseCondBasic(q))
      }

      if (subClause.length > 0) {
        return subClause.join(' AND ')
      }

      return 'TRUE'
    }

    const parseCondBasic = (cond: any) => {
      const cList: string[] = []

      const doDefault = (k: string, v: any) => {
        cList.push(`${this.fields.add(k)} = ${this.params.add(v)}`)
      }

      for (let [k, v] of Object.entries(cond)) {
        let isPushed = false
        if (k.includes('.')) {
          const kn = k.split('.')
          k = `json_extract(${this.fields.add(kn[0])}, '$.${kn.slice(1).join('.')}')`
        }

        if (v instanceof Date) {
          v = v.toISOString()
        }

        if (v) {
          if (Array.isArray(v)) {
            if (v.length > 1) {
              cList.push(`${this.fields.add(k)} IN (${v.map((v0) => `${this.params.add(v0)}`).join(',')})`)
            } else if (v.length === 1) {
              cList.push(`${this.fields.add(k)} = ${this.params.add(v[0])}`)
            }
          } else if (!!v && typeof v === 'object' && !Array.isArray(v)) {
            const op = Object.keys(v!)[0]
            let v1 = (v as any)[op]
            if (v1 instanceof Date) {
              v1 = v1.toISOString()
            }

            if (Array.isArray(v1)) {
              switch (op) {
                case '$in':
                  if (v1.length > 1) {
                    cList.push(`${this.fields.add(k)} IN (${v1.map((v0) => this.params.add(v0)).join(',')})`)
                  } else if (v1.length === 1) {
                    cList.push(`${this.fields.add(k)} = ${this.params.add(v1[0])}`)
                  }
                  isPushed = true
                  break
                case '$nin':
                  if (v1.length > 1) {
                    cList.push(`${this.fields.add(k)} NOT IN (${v1.map((v0) => this.params.add(v0)).join(',')})`)
                  } else {
                    cList.push(`${this.fields.add(k)} != ${this.params.add(v1[0])}`)
                  }
                  isPushed = true
                  break
              }
            }

            if (isPushed) {
              continue
            }

            if (v1 && typeof v1 === 'object') {
              if (v1 instanceof Date) {
                v1 = v1.toISOString()
              } else {
                v1 = JSON.stringify(v1)
              }
            }

            switch (op) {
              case '$like':
                cList.push(`${this.fields.add(k)} LIKE ${this.params.add(v1)}`)
                break
              case '$nlike':
                cList.push(`${this.fields.add(k)} NOT LIKE ${this.params.add(v1)}`)
                break
              case '$substr':
                cList.push(`${this.fields.add(k)} LIKE '%'||${this.params.add(v1)}||'%'`)
                break
              case '$nsubstr':
                cList.push(`${this.fields.add(k)} NOT LIKE '%'||${this.params.add(v1)}||'%'`)
                break
              case '$exists':
                cList.push(`${this.fields.add(k)} IS ${v1 ? 'NOT NULL' : 'NULL'}`)
                break
              case '$gt':
                cList.push(`${this.fields.add(k)} > ${this.params.add(v1)}`)
                break
              case '$gte':
                cList.push(`${this.fields.add(k)} >= ${this.params.add(v1)}`)
                break
              case '$lt':
                cList.push(`${this.fields.add(k)} < ${this.params.add(v1)}`)
                break
              case '$lte':
                cList.push(`${this.fields.add(k)} <= ${this.params.add(v1)}`)
                break
              case '$ne':
                cList.push(`${this.fields.add(k)} != ${this.params.add(v1)}`)
                break
              default:
                doDefault(k, v)
            }
          } else {
            doDefault(k, v)
          }
        } else {
          doDefault(k, v)
        }
      }

      if (cList.length > 0) {
        return cList.filter((el) => el).map((el) => `(${el})`).join(' AND ')
      }
      return 'TRUE'
    }

    return parseCond(q)
  }
}
