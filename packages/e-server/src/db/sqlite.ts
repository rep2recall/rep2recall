import sqlite from 'sqlite'
import sql3 from 'sqlite3'
import { nanoid } from 'nanoid'
import QSearch from '@patarapolw/qsearch'
import dotProp from 'dot-prop-immutable'
import * as z from 'zod'
import { Observable } from 'observable-fns'
import { Serialize } from 'any-serialize'

import { defaultDbStat, zInsertCardQuizItem, zQueryItem, zInsertLessonDeckItem } from './schema'
import { generateSecret, sorter, removeNull, slugify, chunks } from './util'

const ser = new Serialize()

export class DbSqlite {
  static async open (filename: string) {
    const db = new DbSqlite(await sqlite.open({
      filename,
      driver: sql3.Database
    }))

    await db.init()

    return db
  }

  static replicate (from: DbSqlite, to: DbSqlite, uids?: string[]) {
    return new Observable<{
      message: string
    }>((obs) => {
      (async () => {
        const getDateSync = (r: any) => Math.max(r.date_created, r.date_sync || 0)

        await to.transaction(() => {
          to.sql.db.parallelize(() => {
            const syncTable = (tableName: string) => {
              from.sql.each(/*sql*/`
              SELECT * FROM ${safeColumnName(tableName)}
              `, (_: any, r1: any) => {
                const uid = r1.uid

                if (uids && !uids.includes(uid)) {
                  return
                }

                to.sql.db.get(/*sql*/`
                SELECT date_created, date_sync FROM ${safeColumnName(tableName)} WHERE [uid] = @uid
                `, { uid }, (_: any, r2: any) => {
                  const updateSync = () => {
                    r1.date_sync = +new Date()

                    to.sql.db.run(/*sql*/`
                    REPLACE INTO ${safeColumnName(tableName)} (${Object.keys(r1).map(safeColumnName)})
                    VALUES (${Object.keys(r1).map((c) => `@${c}`)})
                    `, r1)
                  }

                  if (r2) {
                    if (getDateSync(r1) > getDateSync(r2)) {
                      updateSync()
                    }
                  } else {
                    updateSync()
                  }
                })
              })
            }

            for (const tableName of ['user', 'card', 'quiz', 'lesson', 'deck']) {
              obs.next({
                message: `Uploading table: ${tableName}`
              })
              syncTable(tableName)
            }
          })
        })

        obs.complete()
      })().catch(obs.error)
    })
  }

  qSearch = new QSearch({
    dialect: 'native',
    schema: {
      key: {},
      tag: {},
      lesson: {},
      deck: {},
      nextReview: { type: 'date' },
      srsLevel: { type: 'number' },
      'stat.streak.right': { type: 'number' },
      'stat.streak.wrong': { type: 'number' },
      'stat.streak.maxRight': { type: 'number' },
      'stat.streak.maxWrong': { type: 'number' },
      'stat.lastRight': { type: 'date' },
      'stat.lastWring': { type: 'date' }
    }
  })

  private constructor (
    public sql: sqlite.Database
  ) {}

  private async init () {
    await this.sql.exec(/*sql*/`
    PRAGMA journal_mode=WAL;
    PRAGMA case_sentitive_like=on;

    CREATE TABLE IF NOT EXISTS user (
      [uid]         TEXT PRIMARY KEY,
      date_created  DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync     DATETIME,
      email         TEXT UNIQUE,
      [secret]      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS [card] (
      [uid]         TEXT PRIMARY KEY,
      date_created  DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync     DATETIME,
      [key]         TEXT NOT NULL,
      userId        TEXT NOT NULL,
      markdown      TEXT NOT NULL DEFAULT '',
      dict_data     TEXT NOT NULL DEFAULT '{}',
      dict_ref      TEXT NOT NULL DEFAULT '{}',
      dict_media    TEXT NOT NULL DEFAULT '{}',
      set_tag       TEXT NOT NULL DEFAULT '{}',
      UNIQUE ([key], userId)
    );

    CREATE TABLE IF NOT EXISTS quiz (
      [uid]           TEXT PRIMARY KEY,
      date_created    DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync       DATETIME,
      cardId          TEXT NOT NULL,
      srsLevel        INTEGER NOT NULL DEFAULT 0,
      date_nextReview DATETIME NOT NULL,
      dict_stat       TEXT NOT NULL DEFAULT '${JSON.stringify(defaultDbStat)}'
    );

    CREATE TABLE IF NOT EXISTS lesson (
      [uid]         TEXT PRIMARY KEY,
      date_created  DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync     DATETIME,
      [name]        TEXT NOT NULL,
      [description] TEXT NOT NULL DEFAULT '',
      set_cardId    TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS deck (
      [uid]         TEXT PRIMARY KEY,
      date_created  DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync     DATETIME,
      [name]        TEXT NOT NULL,
      lessonId      TEXT NOT NULL,
      UNIQUE ([name], lessonId)
    );
    `)
  }

  async signInOrCreate (email?: string) {
    const newUser = {
      uid: nanoid(),
      email,
      secret: generateSecret()
    }

    await this.sql.run(/*sql*/`
    INSERT INTO user (${Object.keys(newUser).map(safeColumnName)})
    VALUES (${Object.keys(newUser).map((c) => `@${c}`)})
    ON CONFLICT DO NOTHING
    `, newUser)

    const r = await this.sql.get(/*sql*/`
    SELECT [uid] FROM user WHERE email = ?
    `, [email || null])

    return r.uid as string
  }

  async getUserId () {
    const { g } = await import('../config')
    g.userId = g.userId || await this.signInOrCreate()

    return g.userId
  }

  async signInWithSecret (email: string, secret: string) {
    const r = await this.sql.get(/*sql*/`
    SELECT [uid] FROM user WHERE email = @email AND [secret] = @secret
    `, { email, secret }) || {}

    return r.uid as string || null
  }

  async newSecret () {
    const uid = await this.getUserId()
    const secret = generateSecret()

    await this.sql.run(/*sql*/`
    UPDATE user
    SET [secret] = @secret
    WHERE [uid] = @uid
    `, {
      uid,
      secret
    })

    return secret
  }

  async query (q: string | Record<string, any>, opts: {
    offset?: number
    limit?: number
    sort?: string[]
    fields?: (keyof z.infer<typeof zQueryItem>)[]
  } = {}): Promise<{
    result: z.infer<typeof zQueryItem>[]
    count: number
  }> {
    const cond = typeof q === 'string' ? this.qSearch.parse(q).cond : q
    const allData = (await this.sql.all(/*sql*/`
    SELECT
      c.uid         [uid],
      c.key         [key],
      c.markdown    markdown,
      c.dict_data   dict_data,
      c.set_tag     set_tag,
      c.dict_ref    dict_ref,
      c.dict_media  dict_media
      ls.name       lesson,
      d.name        deck,
      q.date_nextReview   date_nextReview,
      q.srsLevel    srsLevel,
      q.dict_stat   dict_stat,
    FROM [card] c
    JOIN deck   d   ON json_extract(d.set_cardId, '$.'||c.uid) = 1
    JOIN lesson ls  ON d.lessonId = ls.uid
    JOIN quiz   q   ON q.cardId = c.uid
    ORDER BY c.date_created DESC
    `)).map((r) => {
      r = removeNull(r)

      for (const k of Object.keys(r)) {
        const [k1, k2] = k.split('_')
        if (k2 && r[k]) {
          if (k1 === 'dict') {
            r[k2] = JSON.parse(r[k])
            delete r[k]
          } else if (k1 === 'set') {
            r[k2] = Object.keys(JSON.parse(r[k]))
            delete r[k]
          } else if (k1 === 'date') {
            r[k2] = new Date(r[k])
            delete r[k]
          }
        }
      }

      for (const k of ['stat.lastRight', 'stat.lastWrong']) {
        const v = dotProp.get(r, k)
        if (v) {
          r = dotProp.set(r, k, new Date(v))
        }
      }

      return r
    }).filter((r) => this.qSearch.filterFunction(cond)(r))

    const { offset = 0, limit, sort = [], fields } = opts
    const end = limit ? offset + limit : undefined

    return {
      result: allData
        .sort(sorter(sort, true))
        .slice(offset, end)
        .map((r) => {
          if (fields) {
            const tmp = r
            r = {}

            for (const k of fields) {
              const v = dotProp.get(tmp, k)
              r = dotProp.set(tmp, k, v)
            }
          }

          return zQueryItem.parse(r)
        }),
      count: allData.length
    }
  }

  async insertCardQuiz (...entries: z.infer<typeof zInsertCardQuizItem>[]) {
    entries = z.array(zInsertCardQuizItem).nonempty().parse(entries)

    const userId = await this.getUserId()
    const idsMap = new Map<string, z.infer<typeof zInsertCardQuizItem>>()

    await this.transaction(() => {
      this.sql.db.parallelize(() => {
        entries.map((el) => {
          const uid = nanoid()
          const key = el.key || uid

          const cardItem = {
            uid,
            key,
            userId,
            markdown: el.markdown,
            dict_data: jsonifyDict(el.data),
            set_tag: jsonifyDict(Object.fromEntries((el.tag || []).map((t) => [t, 1]))),
            dict_ref: jsonifyDict(el.ref),
            dict_media: jsonifyDict(el.media)
          }

          this.sql.db.run(/*sql*/`
          ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO [card](${Object.keys(cardItem).map(safeColumnName)})
          VALUES (${Object.keys(cardItem).map((c) => `@${c}`)})
          ${el.onConflict === 'ignore' ? /*sql*/'ON CONFLICT DO NOTHING' : ''}
          `, cardItem, (err) => {
            if (err) {
              throw err
            }

            this.sql.db.get(/*sql*/`
            SELECT [uid] cardId FROM [card]
            WHERE [key] = @key AND userId = @userId
            `, { key, userId }, async (err, { cardId }) => {
              if (err) {
                throw err
              }

              const quizItem = {
                uid: nanoid(),
                cardId,
                srsLevel: el.srsLevel,
                date_nextReview: el.nextReview ? +new Date(el.nextReview) : undefined,
                dict_stat: jsonifyDict(el.stat)
              }

              this.sql.db.run(/*sql*/`
              ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO quiz (${Object.keys(quizItem).map(safeColumnName)})
              VALUES (${Object.keys(quizItem).map((c) => `@${c}`)})
              ${el.onConflict === 'ignore' ? /*sql*/'ON CONFLICT DO NOTHING' : ''}
              `, quizItem)

              idsMap.set(cardId, el)
            })
          })
        })
      })
    })

    return idsMap
  }

  async insertLessonDeck (...entries: z.infer<typeof zInsertLessonDeckItem>[]) {
    entries = z.array(zInsertLessonDeckItem).nonempty().parse(entries)
    const idsMap = new Map<string, z.infer<typeof zInsertLessonDeckItem>>()

    await this.transaction(() => {
      this.sql.db.parallelize(() => {
        entries.map((el) => {
          const lessonId = el.lessonId || nanoid()
          const lessonItem = {
            uid: lessonId,
            name: el.lessonName,
            description: el.lessonDescription
          }

          this.sql.db.run(/*sql*/`
          ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO lesson
          (${Object.keys(lessonItem).map(safeColumnName)})
          VALUES (${Object.keys(lessonItem).map((c) => `@${c}`)})
          ${el.onConflict === 'ignore' ? 'ON CONFLICT DO NOTHING' : ''}
          `, lessonItem, (err) => {
            if (err) {
              throw err
            }

            const deckItem = {
              uid: nanoid(),
              name: el.deck,
              lessonId
            }

            this.sql.db.run(/*sql*/`
            ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO deck
            (${Object.keys(deckItem).map(safeColumnName)})
            VALUES (${Object.keys(deckItem).map((c) => `@${c}`)})
            `, deckItem, (err) => {
              if (err) {
                throw err
              }

              if (el.cardIds) {
                this.sql.db.get(/*sql*/`
                SELECT [uid] deckId, set_cardId FROM deck
                WHERE [name] = @name AND lessonId = @lessonId
                `, { name: el.deck, lessonId }, (err, { deckId, set_cardId }) => {
                  if (err) {
                    throw err
                  }

                  const existingCardIds = new Set(Object.keys(set_cardId))
                  const newCardIds = el.cardIds || []

                  if (newCardIds.some((cid) => existingCardIds.has(cid))) {
                    newCardIds.map((cid) => existingCardIds.add(cid))

                    this.sql.db.run(/*sql*/`
                    UPDATE deck
                    SET set_cardId = ?
                    WHERE [uid] = ?
                    `, [
                      JSON.stringify(Object.fromEntries(Array.from(existingCardIds).map((cid) => [cid, 1]))),
                      deckId
                    ])
                  }
                })
              }
            })
          })

          idsMap.set(lessonId, el)
        })
      })
    })

    return idsMap
  }

  import (filename: string) {
    return new Observable<{
      message: string
    }>((obs) => {
      (async () => {
        obs.next({
          message: `Opening: ${filename}`
        })
        const srcDb = await DbSqlite.open(filename)
        DbSqlite.replicate(srcDb, this)
          .subscribe(
            obs.next,
            obs.error,
            obs.complete
          )
      })()
    })
  }

  export (
    q: string | Record<string, any>, filename: string
  ) {
    return new Observable<{
      message: string
      percent?: number
    }>((obs) => {
      (async () => {
        const uids = new Set<string>()

        obs.next({
          message: 'Getting userId'
        })
        uids.add(await this.getUserId())

        const promises: Promise<any>[] = []

        obs.next({
          message: 'Querying'
        })
        const rCard = await this.query(q, {
          fields: ['uid', 'ref', 'media', 'deck', 'lesson']
        })
        rCard.result.map(({ uid, ref, media, deck, lesson }) => {
          if (uid) {
            uids.add(uid)
          }
          if (ref) {
            Object.entries(ref).map(([k, v]) => {
              if (v === 1) {
                uids.add(k)
              }
            })
          }
          if (media) {
            Object.entries(media).map(([k, v]) => {
              if (v === 1) {
                uids.add(k)
              }
            })
          }
          promises.push((async () => {
            (await this.sql.all(/*sql*/`
            SELECT q.uid quizId
            FROM [card] c
            JOIN quiz q ON q.cardId = c.uid
            WHERE cardId = @cardId
            `, { cardId: uid })).map(({ quizId }) => {
              uids.add(quizId)
            })
          })())

          promises.push((async () => {
            (await this.sql.all(/*sql*/`
            SELECT d.uid deckId, ls.uid lessonId
            FROM deck d
            JOIN lesson ls ON d.lessonId = ls.uid
            WHERE ls.name = @lesson AND d.name = @deck
            `, { lesson, deck })).map(({ deckId, lessonId }) => {
              uids.add(deckId)
              uids.add(lessonId)
            })
          })())
        })

        obs.next({
          message: 'Awaiting query results'
        })
        await Promise.all(promises)

        obs.next({
          message: 'Creating destination database'
        })
        const dstDb = await DbSqlite.open(filename)

        DbSqlite.replicate(this, dstDb, Array.from(uids))
          .subscribe(
            obs.next,
            obs.error,
            obs.complete
          )
      })()
    })
  }

  importAnki2 (filename: string, meta: {
    originalFilename?: string
  } = {}) {
    return new Observable<{
      message: string
      percent?: number
    }>((obs) => {
      (async () => {
        obs.next({
          message: `Opening ${filename} as SQLite database`
        })
        const srcDb = await sqlite.open({
          filename,
          driver: sql3.Database
        })

        obs.next({
          message: 'Creating additional tables'
        })
        await srcDb.exec(/*sql*/`
        CREATE TABLE IF NOT EXISTS decks (
          id      INTEGER PRIMARY KEY,
          [name]  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS media (
          id      INTEGER PRIMARY KEY,
          [name]  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS models (
          id      INTEGER PRIMARY KEY,
          [name]  TEXT NOT NULL,
          flds    TEXT NOT NULL,  -- \x1f field
          css     TEXT
        );
        CREATE TABLE IF NOT EXISTS templates (
          mid     INTEGER NOT NULL REFERENCES models(id),
          ord     INTEGER NOT NULL,
          [name]  TEXT NOT NULL,
          qfmt    TEXT NOT NULL,
          afmt    TEXT
        );
        `)

        obs.next({
          message: 'Filling additional tables with JSON data from table: col'
        })

        const { decks, models } = await srcDb.get(/*sql*/`
          SELECT decks, models FROM col
        `)!

        await Promise.all(Object.values(JSON.parse(decks)).map(async (d: any) => {
          await srcDb.run(/*sql*/`
            INSERT INTO decks (id, [name]) VALUES (?, ?)
          `, [parseInt(d.id), d.name])
        }))

        await Promise.all(Object.values(JSON.parse(models)).map(async (m: any) => {
          await srcDb.run(/*sql*/`
          INSERT INTO models (id, [name], flds, css)
          VALUES (?, ?, ?, ?)
        `, [parseInt(m.id), m.name, m.flds.map((f: any) => f.name).join('\x1f'), m.css])

          await Promise.all(m.tmpls.map(async (t: any, i: number) => {
            await srcDb.run(/*sql*/`
            INSERT INTO templates (mid, ord, [name], qfmt, afmt)
            VALUES (?, ?, ?, ?, ?)
          `, [parseInt(m.id), i, t.name, t.qfmt, t.afmt])
          }))
        }))

        const normalizeAnkiMustache = (s: string, keyData: string) => s.replace(
          /\{\{([^}]+?)\}\}/g,
          (_, p1) => {
            const [, prefix = '', type, name] = /^([/#])?(?:([^:]+?):)?(.+)$/.exec(p1) || ['', '', '', p1]

            if (prefix || type === 'text') {
              return `{{${prefix}${keyData}.data.${slugify(name)}}}`
            } else if (type === 'type') {
              return `<input type=text id=typeans placeholder="${keyData}.data.${slugify(name)}" />`
            }

            return `{{{${keyData}.data.${slugify(name)}}}}`
          }
        )

        const allAnkiCards = (await srcDb.all(/*sql*/`
          SELECT
            d.name AS deck,
            n.flds AS [values],
            m.flds AS keys,
            m.css AS css,
            t.qfmt AS qfmt,
            t.afmt AS afmt,
            t.name AS template,
            m.name AS model
          FROM cards AS c
          JOIN notes AS n ON c.nid = n.id
          JOIN decks AS d ON c.did = d.id
          JOIN models AS m ON n.mid = m.id
          JOIN templates AS t ON t.ord = c.ord AND t.mid = n.mid
        `)).map((el) => {
          const ks: string[] = el.keys.split('\x1f').map((k: string) => slugify(k))
          const vs: string[] = el.values.split('\x1f')
          const data: Record<string, string> = {}
          ks.map((k, i) => { data[k] = vs[i] })

          const keyData = 'data_' + ser.hash(data)
          const keyAnki = slugify(`anki_${name}_${el.model}_${el.template}_${keyData}`)

          const css = el.css.trim() + '\n'
          const keyCss = css ? 'css_' + ser.hash({ css }) : null

          const qfmt = normalizeAnkiMustache(el.qfmt, keyData)
          const afmt = normalizeAnkiMustache(el.afmt, keyData)

          return {
            data,
            keyData,
            keyAnki,
            css,
            keyCss,
            qfmt,
            afmt,
            deck: el.deck.replace(/\//g, '_').replace(/::/g, '/') as string
          }
        })

        await srcDb.close()

        obs.next({
          message: `Inserting Anki cards (total: ${allAnkiCards.length})`
        })

        const lesson = (meta.originalFilename || filename).replace(/\..+?$/, '')
        const toBeInsertedId = new Set<string>()

        for (const [i, cs] of chunks(allAnkiCards, 1000).entries()) {
          obs.next({
            message: `inserting cards: ${i * 1000} of ${allAnkiCards.length}`,
            percent: i * 1000 / allAnkiCards.length * 100
          })

          const cardIdMap = await this.insertCardQuiz(...cs.map(({
            keyData,
            keyCss,
            keyAnki,
            data,
            qfmt,
            afmt,
            css
          }) => {
            const cs: z.infer<typeof zInsertCardQuizItem>[] = [
              {
                key: keyAnki,
                ref: {
                  [keyData]: 1,
                  ...(keyCss ? {
                    [keyCss]: 1
                  } : {})
                },
                markdown: qfmt + '\n\n===\n\n' + afmt + (keyCss ? ('\n\n===\n\n' + `{{{${keyCss}.markdown}}}`) : '')
              }
            ]

            if (!toBeInsertedId.has(keyData)) {
              toBeInsertedId.add(keyData)
              cs.push({
                onConflict: 'ignore',
                key: keyData,
                data
              })
            }

            if (keyCss && !toBeInsertedId.has(keyCss)) {
              toBeInsertedId.add(keyCss)
              cs.push({
                onConflict: 'ignore',
                key: keyCss,
                markdown: '```css parsed\n' + css + '\n```'
              })
            }

            toBeInsertedId.add(keyAnki)
            return cs
          }).reduce((prev, c) => [...prev, ...c], []))

          const cardAnkiKeyToIdMap = new Map<string, string>()
          Array.from(cardIdMap).map(([cardId, el]) => {
            if (el.key && el.key.startsWith('anki_')) {
              cardAnkiKeyToIdMap.set(el.key, cardId)
            }
          })

          await this.insertLessonDeck(...cs.map(({
            keyAnki,
            deck
          }) => {
            const cardId = cardAnkiKeyToIdMap.get(keyAnki)

            if (cardId) {
              return {
                lesson,
                lessonDescription: meta.originalFilename,
                deck,
                cardIds: []
              }
            }
            return null
          }).filter((el) => el).map((el) => el!))
        }

        obs.complete()
      })().catch(obs.error)
    })
  }

  async transaction (processing: () => void) {
    return new Promise((resolve, reject) => {
      this.sql.db.serialize(() => {
        this.sql.db.exec(`
        BEGIN TRANSACTION;
        PRAGMA read_uncommited=on;
        `)

        processing()

        this.sql.db.exec(`
        COMMIT;
        PRAGMA read_uncommited=off;
        `, (err) => err ? reject(err) : resolve)
      })
    })
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

export function jsonifyDict (a: any) {
  if (!a) {
    return undefined
  }

  if (typeof a === 'object' && !Array.isArray(a)) {
    return JSON.stringify(a)
  }

  throw new Error(`Not an object: ${a}`)
}
