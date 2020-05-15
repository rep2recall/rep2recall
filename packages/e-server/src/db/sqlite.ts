import sqlite from 'sqlite'
import sql3 from 'sqlite3'
import { nanoid } from 'nanoid'
import QSearch from '@patarapolw/qsearch'
import dotProp from 'dot-prop-immutable'
import * as z from 'zod'
import { Observable } from 'observable-fns'
import { Serialize } from 'any-serialize'

import { defaultDbStat, zInsertCardQuizItem, zQueryItem, zInsertLessonDeckItem, zInsertItem, zUpdateItem } from './schema'
import { sorter, removeNull, slugify, chunks, deepMerge } from './util'

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

        await to.transaction(async () => {
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

            for (const tableName of ['card', 'quiz', 'lesson', 'deck']) {
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

  types = {
    dict: {
      is (a: any) {
        return !!a && typeof a === 'object' && !Array.isArray(a)
      },
      toSql (a: any) {
        return this.is(a) ? JSON.stringify(a) : null
      },
      toNative (s?: string) {
        return s ? JSON.parse(s) : null
      }
    },
    set: {
      sep: '\x1f',
      is (a: any): a is Array<any> | Set<any> {
        return Array.isArray(a) || a instanceof Set
      },
      toSql (a: any) {
        if (!this.is(a)) {
          return null
        }

        return this.sep + Array.from(a).join(this.sep) + this.sep
      },
      toNative (s?: string) {
        return s ? s.split(this.sep).filter((el) => el) : null
      }
    },
    date: {
      toSql (a: any) {
        return a ? +new Date(a) : null
      },
      toNative (s?: number) {
        return s ? new Date(s) : null
      }
    }
  }

  private constructor (
    public sql: sqlite.Database
  ) {}

  private async init () {
    await this.sql.exec(/*sql*/`
    PRAGMA journal_mode=WAL;
    PRAGMA case_sentitive_like=on;

    CREATE TABLE IF NOT EXISTS [card] (
      [uid]         TEXT PRIMARY KEY,
      date_created  DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync     DATETIME,
      [key]         TEXT NOT NULL UNIQUE,
      markdown      TEXT,
      dict_data     TEXT,
      set_media     TEXT,
      set_ref       TEXT,
      set_tag       TEXT
    );

    CREATE INDEX IF NOT EXISTS card_key_idx ON [card]([key]);
    CREATE INDEX IF NOT EXISTS card_set_media_idx ON [card](set_media);
    CREATE INDEX IF NOT EXISTS card_set_ref_idx ON [card](set_ref);
    CREATE INDEX IF NOT EXISTS card_set_tag_idx ON [card](set_tag);

    CREATE TABLE IF NOT EXISTS quiz (
      [uid]           TEXT PRIMARY KEY,
      date_created    DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync       DATETIME,
      cardId          TEXT NOT NULL,
      srsLevel        INTEGER NOT NULL DEFAULT 0,
      date_nextReview DATETIME NOT NULL,
      dict_stat       TEXT NOT NULL DEFAULT '${JSON.stringify(defaultDbStat)}'
    );

    CREATE INDEX IF NOT EXISTS quiz_cardId_idx ON quiz(cardId);

    CREATE TABLE IF NOT EXISTS lesson (
      [uid]         TEXT PRIMARY KEY,
      date_created  DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync     DATETIME,
      [key]         TEXT NOT NULL UNIQUE,
      [name]        TEXT NOT NULL,
      [description] TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS lesson_set_cardId_idx ON lesson(set_cardId);

    CREATE TABLE IF NOT EXISTS deck (
      [uid]         TEXT PRIMARY KEY,
      date_created  DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_sync     DATETIME,
      [name]        TEXT NOT NULL,
      lessonId      TEXT NOT NULL,
      set_cardId    TEXT
      UNIQUE ([name], lessonId)
    );

    CREATE INDEX IF NOT EXISTS deck_lessonId_idx ON deck(lessonId);
    `)
  }

  async query (q: string | Record<string, any>, opts: {
    offset?: number
    limit?: number
    sort?: string[]
    fields?: (keyof z.infer<typeof zQueryItem> | 'uid')[]
  } = {}): Promise<{
    result: (z.infer<typeof zQueryItem> & {
      uid?: string
    })[]
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
      c.set_ref     set_ref,
      c.set_media   set_media,
      ls.name       lesson,
      d.name        deck,
      q.date_nextReview   date_nextReview,
      q.srsLevel    srsLevel,
      q.dict_stat   dict_stat,
    FROM [card] c
    JOIN deck   d   ON d.set_cardId LIKE '\x1f'||c.uid||'\x1f'
    JOIN lesson ls  ON d.lessonId = ls.uid
    JOIN quiz   q   ON q.cardId = c.uid
    ORDER BY c.date_created DESC
    `)).map((r) => {
      r = removeNull(r)

      for (const k of Object.keys(r)) {
        const [k1, k2] = k.split('_')
        if (k2 && r[k]) {
          if (k1 === 'dict' || k1 === 'set' || k1 === 'date') {
            r[k2] = this.types[k1].toNative(r[k])
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
    const idsMap = new Map<string, z.infer<typeof zInsertCardQuizItem>>()

    await this.transaction(async () => {
      this.sql.db.parallelize(() => {
        entries.map((el) => {
          const uid = nanoid()
          const key = el.key || uid
          el.key = key

          const cardItem = {
            uid,
            key,
            markdown: el.markdown,
            dict_data: this.types.dict.toSql(el.data),
            set_tag: this.types.set.toSql(el.tag),
            set_ref: this.types.set.toSql(el.ref),
            set_media: this.types.set.toSql(el.media)
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
            WHERE [key] = @key
            `, { key }, async (err, { cardId }) => {
              if (err) {
                throw err
              }

              const quizItem = {
                uid: nanoid(),
                cardId,
                srsLevel: el.srsLevel,
                date_nextReview: el.nextReview ? +new Date(el.nextReview) : undefined,
                dict_stat: this.types.dict.toSql(el.stat)
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

    await this.transaction(async () => {
      this.sql.db.parallelize(() => {
        entries.map((el) => {
          const lessonId = nanoid()
          const lessonItem = (() => {
            if (el.lesson) {
              el.lessonKey = el.lessonKey || nanoid()

              return {
                uid: lessonId,
                key: el.lessonKey || nanoid(),
                name: el.lesson,
                description: el.lessonDescription
              }
            } else {
              el.onConflict = 'ignore'

              return {
                uid: lessonId,
                key: '_',
                name: 'Default',
                description: 'Entries outside lessons will be here.'
              }
            }
          })()

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

                  const existingCardIds = new Set(this.types.set.toNative(set_cardId))
                  const newCardIds = el.cardIds || []

                  if (newCardIds.some((cid) => existingCardIds.has(cid))) {
                    newCardIds.map((cid) => existingCardIds.add(cid))

                    this.sql.db.run(/*sql*/`
                    UPDATE deck
                    SET set_cardId = ?
                    WHERE [uid] = ?
                    `, [
                      this.types.set.toSql(Array.from(existingCardIds)),
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
      })().catch(obs.error)
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
            ref.map((r) => uids.add(r))
          }
          if (media) {
            media.map((r) => uids.add(r))
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
      })().catch(obs.error)
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
                ref: [keyData, keyCss || ''].filter((el) => el),
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

  async insert (...entries: z.infer<typeof zInsertItem>[]) {
    const cardEntries = entries.map(({
      onConflict, key, markdown, data, tag, ref, media, srsLevel, nextReview, stat
    }) => zInsertCardQuizItem.parse({
      onConflict, key, markdown, data, tag, ref, media, srsLevel, nextReview, stat
    }))

    const rCard = await this.insertCardQuiz(...cardEntries)
    const cardKeyToIdMap = new Map(Array.from(rCard)
      .map(([k, v]) => [v.key!, k]))

    const lessonEntries = entries.map(({
      lessonKey, lesson, lessonDescription, deck, key
    }) => {
      const cardId = cardKeyToIdMap.get(key!)
      return zInsertCardQuizItem.parse({
        onConflict: 'ignore', lessonKey, lesson, lessonDescription, deck, cardIds: cardId ? [cardId] : undefined
      })
    })

    await this.insertLessonDeck(...lessonEntries)

    return cardKeyToIdMap
  }

  async update (keys: string[], set: z.infer<typeof zUpdateItem>) {
    keys = z.array(z.string()).nonempty().parse(keys)
    const {
      key, markdown, data, tag, ref, media,
      srsLevel, nextReview, stat,
      lessonKey, lesson, lessonDescription,
      deck
    } = zInsertItem.parse(set)

    await this.transaction(async (done) => {
      const cardIds: string[] = []

      if ([data, tag, ref, media].some((el) => typeof el !== 'undefined')) {
        keys.map(async (k) => {
          let newData = {
            dict_data: data as any,
            set_tag: tag as any,
            set_ref: ref as any,
            set_media: media as any
          }

          const { uid, dict_data, set_tag, set_ref, set_media } = await this.sql.get(/*sql*/`
          SELECT [uid], ${Object.keys(newData).map(safeColumnName)} FROM [card]
          WHERE [key] = @key
          `, { key: k })!

          cardIds.push(uid)

          let newDictData: Record<string, any> | undefined
          if (data) {
            newDictData = deepMerge(this.types.dict.toNative(dict_data) || {}, data)
          }

          let newSetTag: Set<string> | undefined
          if (tag) {
            newSetTag = new Set(this.types.set.toNative(set_tag) || [])
            tag.map((t) => newSetTag!.add(t))
          }

          let newSetRef: Set<string> | undefined
          if (ref) {
            newSetRef = new Set(this.types.set.toNative(set_ref) || [])
            ref.map((r) => newSetRef!.add(r))
          }

          let newSetMedia: Set<string> | undefined
          if (media) {
            newSetMedia = new Set(this.types.set.toNative(set_media) || [])
            media.map((m) => newSetMedia!.add(m))
          }

          newData = ser.clone(removeNull({
            dict_data: this.types.dict.toSql(newDictData),
            set_tag: this.types.set.toSql(newSetTag),
            set_ref: this.types.set.toSql(newSetRef),
            set_media: this.types.set.toSql(newSetMedia)
          }))

          this.sql.db.run(/*sql*/`
          UPDATE [card]
          SET ${Object.keys(newData).map((k) => `${safeColumnName(k)} = @${k}`)}
          WHERE [uid] = @uid
          `, {
            ...newData,
            uid
          })
        })
      }

      this.sql.db.parallelize(async () => {
        if (cardIds.length === 0) {
          for (const ks of chunks(keys, 900)) {
            (await this.sql.all(/*sql*/`
            SELECT [uid] FROM [card] WHERE [key] IN (${Array(ks.length).fill('?')})
            `, ks)).map((r) => cardIds.push(r.uid))
          }
        }

        if ([key, markdown].some((t) => typeof t !== 'undefined')) {
          const update = ser.clone({ key, markdown })

          for (const ids of chunks(cardIds, 900)) {
            const params = Object.values(update) as any[]
            params.push(...ids)

            this.sql.db.run(/*sql*/`
            UPDATE [card]
            SET ${Object.keys(update).map((c) => `${safeColumnName(c)} = ?`)}
            WHERE [uid] IN (${Array(ids.length).fill('?')})
            `, params)
          }
        }

        if ([srsLevel, nextReview].some((t) => typeof t !== 'undefined')) {
          const update = ser.clone({ srsLevel, date_nextReview: this.types.date.toSql(nextReview) || undefined })

          for (const ids of chunks(cardIds, 900)) {
            const params = Object.values(update) as any[]
            params.push(...ids)

            this.sql.db.run(/*sql*/`
            UPDATE quiz
            SET ${Object.keys(update).map((c) => `${safeColumnName(c)} = ?`)}
            WHERE cardId IN (${Array(ids.length).fill('?')})
            `, params)
          }
        }

        if (stat) {
          for (const ids of chunks(cardIds, 900)) {
            const params = [this.types.dict.toSql(stat)]
            params.push(...ids)

            this.sql.db.run(/*sql*/`
            UPDATE quiz
            SET dict_stat = json_patch(dict_stat, ?)
            WHERE cardId IN (${Array(ids.length).fill('?')})
            `)
          }
        }

        let lessonId: string | null = null
        let isNewLesson = false
        if (lessonKey) {
          const ls = await this.sql.get(/*sql*/`
          SELECT [uid] FROM lesson WHERE [key] = ?
          `, [lessonKey]) || {}

          if (ls) {
            lessonId = ls.uid
          } else if (lesson) {
            lessonId = nanoid()

            await new Promise((resolve, reject) => {
              const newLesson = {
                uid: lessonId,
                key: lessonKey,
                name: lesson,
                description: lessonDescription
              }
              isNewLesson = true

              this.sql.db.run(/*sql*/`
              INSERT INTO lesson (${Object.keys(newLesson).map(safeColumnName)})
              VALUES (${Object.keys(newLesson).map((c) => `@${c}`)})
              `, newLesson, (err) => err ? reject(err) : resolve())
            })
          }
        }

        if (!isNewLesson && [lessonKey, lesson, lessonDescription].some((t) => typeof t !== 'undefined')) {
          const update = ser.clone({ key: lessonKey, name: lesson, description: lessonDescription })

          this.sql.db.run(/*sql*/`
          UPDATE lesson
          SET ${Object.keys(update).map((c) => `${safeColumnName(c)} = @c`)}
          WHERE [uid] = @lessonId
          `, {
            ...update,
            lessonId
          })
        }

        if (lessonId && deck) {
          const d = await this.sql.get(/*sql*/`
          SELECT set_cardId FROM deck
          WHERE lessonId = @lessonId AND [name] = @deck
          `, { lessonId, deck })

          if (d) {
            const setCardId = new Set(this.types.set.toNative(d.set_cardId))
            keys.map((k) => setCardId.add(k))

            this.sql.db.run(/*sql*/`
            UPDATE deck
            SET set_cardId = @set_cardId
            WHERE lessonId = @lessonId AND [name] = @deck
            `, {
              set_cardId: this.types.set.toSql(setCardId),
              lessonId,
              deck
            })
          } else {
            const newDeck = removeNull({
              uid: nanoid(),
              name: deck,
              lessonId,
              set_cardId: this.types.set.toSql(keys)
            })

            this.sql.db.run(/*sql*/`
            INSERT INTO deck (${Object.keys(newDeck).map(safeColumnName)})
            VALUES (${Object.keys(newDeck).map((c) => `@${c}`)})
            `, newDeck)
          }
        }

        done()
      })
    }, true)
  }

  async delete (...keys: string[]) {
    await this.transaction(async () => {
      const cardIds: string[] = []

      for (const ks of chunks(keys, 900)) {
        (await this.sql.all(/*sql*/`
        SELECT [uid] FROM [card]
        WHERE [key] IN (${Array(ks.length).fill('?')})
        `, ks)).map((r) => {
          cardIds.push(r.uid)
        })
      }

      const decks = (await this.sql.all(/*sql*/`
      SELECT [uid], set_cardId FROM deck
      `)).map((d) => {
        const setCardId = new Set(this.types.set.toNative(d.set_cardId))
        cardIds.map((id) => setCardId.delete(id))

        return {
          uid: d.uid,
          set_cardId: this.types.set.toSql(setCardId)
        }
      })

      this.sql.db.parallelize(() => {
        for (const ids of chunks(cardIds, 900)) {
          this.sql.db.run(/*sql*/`
          DELETE FROM [card]
          WHERE [uid] IN (${Array(ids.length).fill('?')})
          `, ids)

          this.sql.db.run(/*sql*/`
          DELETE FROM quiz
          WHERE cardId IN (${Array(ids.length).fill('?')})
          `, ids)
        }

        for (const d of decks.filter((d) => d.set_cardId)) {
          this.sql.db.run(/*sql*/`
          UPDATE deck
          SET set_cardId = @set_cardId
          WHERE [uid] = @uid
          `, d)
        }

        for (const ids of chunks(
          decks.filter((d) => !d.set_cardId).map((d) => d.uid),
          900
        )) {
          this.sql.db.run(/*sql*/`
          DELETE FROM deck
          WHERE [uid] IN (${Array(ids.length).fill('?')})
          `, ids)
        }
      })
    })
  }

  async transaction (processing: (done: () => void) => Promise<void>, awaitDone?: boolean) {
    return new Promise((resolve, reject) => {
      this.sql.db.serialize(() => {
        this.sql.db.exec(`
        BEGIN TRANSACTION;
        PRAGMA read_uncommited=on;
        `)

        const onDone = () => {
          this.sql.db.exec(`
          COMMIT;
          PRAGMA read_uncommited=off;
          `, (err) => {
            if (err) {
              return reject(err)
            }

            err ? reject(err) : resolve()
          })
        }

        processing(onDone).then(() => {
          if (!awaitDone) {
            onDone()
          }
        })
      })
    })
  }

  async renderMin (key: string): Promise<{
    key: string
    data?: Record<string, any>
    ref?: string[]
    media?: string[]
    markdown?: string
  } | null> {
    const r = await this.sql.get(/*sql*/`
    SELECT [key], dict_data, markdown, set_ref, set_media
    FROM [card]
    WHERE [key] = ?
    `, [key])

    if (r) {
      return removeNull({
        key: r.key,
        data: this.types.dict.toNative(r.dict_data),
        ref: this.types.set.toNative(r.set_ref),
        media: this.types.set.toNative(r.set_media),
        markdown: r.markdown
      })
    }

    return null
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
