import sqlite3 from 'better-sqlite3'

export class TempTable {
  maxId = 0
  newItems = new Set<any>()
  overwriteItems = new Set<any>()
  uniqueKey: Map<string, Map<string, number>> = new Map()
  uniqueColumns: string[] = []

  constructor (
    public db: sqlite3.Database,
    public tableName: string,
    public columns: string[],
    public uniquePairs: string[][]
  ) {
    this.uniqueColumns = Array.from(new Set(uniquePairs.reduce((prev, c) => [...prev, ...c], [])))

    for (const r of this.db.prepare(/*sql*/`
    SELECT ROWID id,${this.uniqueColumns.map((c) => safeColumnName(c)).join(',')}
    FROM ${safeColumnName(tableName)}
    `).iterate()) {
      this.maxId = Math.max(this.maxId, r.id)
      for (const uniquePair of uniquePairs) {
        const key = JSON.stringify(uniquePair)
        const value = JSON.stringify(uniquePair.map((col) => r[col]))

        const s = this.uniqueKey.get(key) || new Map<string, number>()
        s.set(value, r.id)
        this.uniqueKey.set(key, s)
      }
    }
  }

  add (r: any, onConflict: 'overwrite' | 'error' | 'ignore') {
    for (const uniquePair of this.uniquePairs) {
      const key = JSON.stringify(uniquePair)
      const value = JSON.stringify(uniquePair.map((col) => r[col]))

      const s = this.uniqueKey.get(key) || new Map<string, number>()
      const id = s.get(value)

      if (!id) {
        this.maxId++
        r.id = this.maxId
        this.newItems.add(r)

        s.set(value, r.id)
        this.uniqueKey.set(key, s)
      } else {
        if (onConflict === 'error') {
          throw new Error(`Unique contraint violated at table: ${this.tableName}; col: ${uniquePair.join(',')}; row: ${JSON.stringify(r)}`)
        } else if (onConflict === 'overwrite') {
          this.overwriteItems.add(r)
        }
        r.id = id
      }
    }

    return r
  }

  commit () {
    const insert = this.db.prepare(/*sql*/`
    INSERT INTO ${safeColumnName(this.tableName)} (${this.columns.map((c) => safeColumnName(c)).join(',')})
    VALUES (${this.columns.map((c) => `@${c}`).join(',')})
    `)
    for (const r of Array.from(this.newItems)) {
      insert.run(r)
    }
    this.newItems.clear()

    for (const r of Array.from(this.overwriteItems)) {
      this.db.prepare(/*sql*/`
      UPDATE ${safeColumnName(this.tableName)}
      SET ${Object.keys(r)
        .filter((k) => k !== 'id')
        .map((k) => `${safeColumnName(k)} = @${k}`)
        .join(',')}
      WHERE ROWID = @id
      `).run(r)
    }
    this.overwriteItems.clear()
  }
}

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
