import { nanoid } from 'nanoid'
import QSearch from '@patarapolw/qsearch'
import dotProp from 'dot-prop-immutable'
import { Observable } from 'observable-fns'
import { Serialize } from 'any-serialize'
import { UploadedFile } from 'express-fileupload'
import sqlite3 from 'better-sqlite3'

import { sorter, removeNull, slugify, chunks, deepMerge } from '../util'
import { repeatReview, srsMap, getNextReview } from './quiz'
import { defaultDbStat } from './defaults'
import { validate } from '../schema/ajv'
import { QueryItem, QueryItemPartial, InsertCardQuizItem, InsertLessonDeckItem, InsertItem, OnConflict, UpdateItem, RenderItemMin } from '../schema/schema'

const ser = new Serialize()

export class DbSqlite {
  static replicate (from: DbSqlite, to: DbSqlite, uids?: string[]) {
    return new Observable<{
      message: string
    }>((obs) => {
      const getDateSync = (r: any) => Math.max(r.date_created, r.date_sync || 0)

      to.sql.transaction(() => {
        const syncTable = (tableName: string) => {
          for (const r1 of from.sql.prepare(/*sql*/`
          SELECT * FROM ${safeColumnName(tableName)}
          `).iterate()) {
            const uid = r1.uid

            if (uids && !uids.includes(uid)) {
              continue
            }

            const r2 = to.sql.prepare(/*sql*/`
            SELECT date_created, date_sync FROM ${safeColumnName(tableName)} WHERE [uid] = @uid
            `).get({ uid })

            const updateSync = () => {
              r1.date_sync = new Date().toISOString()

              to.sql.prepare(/*sql*/`
              REPLACE INTO ${safeColumnName(tableName)} (${Object.keys(r1).map(safeColumnName)})
              VALUES (${Object.keys(r1).map((c) => `@${c}`)})
              `).run(r1)
            }

            if (r2) {
              if (getDateSync(r1) > getDateSync(r2)) {
                updateSync()
              }
            } else {
              updateSync()
            }
          }
        }

        for (const tableName of ['card', 'quiz', 'lesson', 'deck']) {
          obs.next({
            message: `Uploading table: ${tableName}`
          })
          syncTable(tableName)
        }
      })

      obs.complete()
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
        return a ? new Date(a).toISOString() : null
      },
      toNative (s?: number) {
        return s ? new Date(s) : null
      }
    }
  }

  sql: sqlite3.Database
  isReady = false

  constructor (
    public filename: string
  ) {
    this.sql = sqlite3(filename)
    this.sql.exec(/*sql*/`
      PRAGMA journal_mode=WAL;
      PRAGMA case_sentitive_like=on;
  
      CREATE TABLE IF NOT EXISTS [card] (
        [uid]         TEXT PRIMARY KEY,
        date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        date_sync     TEXT,
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
        date_created    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        date_sync       TEXT,
        cardId          TEXT NOT NULL,
        srsLevel        INTEGER NOT NULL DEFAULT 0,
        date_nextReview TEXT NOT NULL,
        dict_stat       TEXT NOT NULL DEFAULT '${JSON.stringify(defaultDbStat)}'
      );
  
      CREATE INDEX IF NOT EXISTS quiz_cardId_idx ON quiz(cardId);
  
      CREATE TABLE IF NOT EXISTS lesson (
        [uid]         TEXT PRIMARY KEY,
        date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        date_sync     TEXT,
        [key]         TEXT NOT NULL UNIQUE,
        [name]        TEXT NOT NULL,
        [description] TEXT
      );
  
      CREATE TABLE IF NOT EXISTS deck (
        [uid]         TEXT PRIMARY KEY,
        date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        date_sync     TEXT,
        [name]        TEXT NOT NULL,
        lessonId      TEXT NOT NULL,
        set_cardId    TEXT,
        UNIQUE ([name], lessonId)
      );
  
      CREATE INDEX IF NOT EXISTS deck_lessonId_idx ON deck(lessonId);
      CREATE INDEX IF NOT EXISTS deck_set_cardId_idx ON deck(set_cardId);
  
      CREATE TABLE IF NOT EXISTS media (
        [uid]         TEXT PRIMARY KEY,
        date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        date_sync     TEXT,
        [key]         TEXT NOT NULL UNIQUE,
        [name]        TEXT NOT NULL,
        mimetype      TEXT,
        [data]        BLOB,
        dict_meta     TEXT
      );
      `)
  }

  normalizeRow (r: any) {
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
  }

  get (key: string) {
    let r = this.sql.prepare(/*sql*/`
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
      q.dict_stat   dict_stat
    FROM [card] c
    JOIN deck   d   ON d.set_cardId LIKE '%\x1f'||c.uid||'\x1f%'
    JOIN lesson ls  ON d.lessonId = ls.uid
    JOIN quiz   q   ON q.cardId = c.uid
    WHERE c.key = ?
    `).get([key])

    if (r) {
      r = this.normalizeRow(r)
      return validate<QueryItem>('schema.json#/definitions/QueryItem', r)
    }

    return null
  }

  query (q: string | Record<string, any>, opts: {
    offset?: number
    limit?: number
    sort?: string[]
    fields?: (keyof QueryItem | 'uid')[]
  } = {}): {
    result: QueryItemPartial[]
    count: number
  } {
    const cond = typeof q === 'string' ? this.qSearch.parse(q).cond : q
    const allData: QueryItemPartial[] = []

    for (let row of this.sql.prepare(/*sql*/`
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
      q.dict_stat   dict_stat
    FROM [card] c
    LEFT JOIN deck   d   ON d.set_cardId LIKE '%\x1f'||c.uid||'\x1f%'
    LEFT JOIN lesson ls  ON d.lessonId = ls.uid
    LEFT JOIN quiz   q   ON q.cardId = c.uid
    ORDER BY c.date_created DESC
    `).iterate()) {
      row = this.normalizeRow(row)

      if (this.qSearch.filterFunction(cond)(row)) {
        allData.push(validate('schema.json#/definitions/QueryItem', row))
      }
    }

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

          return validate('schema.json#/definitions/QueryItemPartial', r)
        }),
      count: allData.length
    }
  }

  insertCardQuiz (...entries: InsertCardQuizItem[]) {
    entries = entries.map((el) => validate('schema.json#/definitions/InsertCardQuizItem', el))
    const idsMap = new Map<string, InsertCardQuizItem>()

    this.sql.transaction(() => {
      this.sql.pragma('read_uncommitted=on;')

      entries.map((el) => {
        const uid = nanoid()
        const key = el.key || uid
        el.key = key

        const cardItem = ser.clone({
          uid,
          key,
          markdown: el.markdown,
          dict_data: this.types.dict.toSql(el.data),
          set_tag: this.types.set.toSql(el.tag),
          set_ref: this.types.set.toSql(el.ref),
          set_media: this.types.set.toSql(el.media)
        })

        this.sql.prepare(/*sql*/`
        ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO [card](${Object.keys(cardItem).map(safeColumnName)})
        VALUES (${Object.keys(cardItem).map((c) => `@${c}`)})
        ${el.onConflict === 'ignore' ? /*sql*/'ON CONFLICT DO NOTHING' : ''}
        `).run(cardItem)

        const { cardId } = this.sql.prepare(/*sql*/`
        SELECT [uid] cardId FROM [card]
        WHERE [key] = @key
        `).get({ key })

        if ([el.srsLevel, el.nextReview, el.stat].every((t) => typeof t !== 'undefined')) {
          const quizItem = removeNull({
            uid: nanoid(),
            cardId,
            srsLevel: el.srsLevel,
            date_nextReview: this.types.date.toSql(el.nextReview),
            dict_stat: this.types.dict.toSql(el.stat)
          })

          this.sql.prepare(/*sql*/`
          ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO quiz (${Object.keys(quizItem).map(safeColumnName)})
          VALUES (${Object.keys(quizItem).map((c) => `@${c}`)})
          ${el.onConflict === 'ignore' ? /*sql*/'ON CONFLICT DO NOTHING' : ''}
          `).run(quizItem)
        }

        idsMap.set(cardId, el)
      })

      this.sql.pragma('read_uncommitted=off;')
    })()

    return idsMap
  }

  insertLessonDeck (...entries: InsertLessonDeckItem[]) {
    entries = entries.map((el) => validate('schema.json#/definitions/InsertLessonDeckItem', el))
    const idsMap = new Map<string, InsertLessonDeckItem>()

    this.sql.transaction(() => {
      this.sql.pragma('read_uncommitted=on;')

      entries.map((el) => {
        const lessonId = nanoid()
        const lessonItem = removeNull((() => {
          if (el.lesson) {
            el.lessonKey = el.lessonKey || el.lesson

            return {
              uid: lessonId,
              key: el.lessonKey || nanoid(),
              name: el.lesson,
              description: el.lessonDescription
            }
          } else {
            return {
              uid: lessonId,
              key: '_',
              name: 'Default',
              description: 'Entries outside lessons will be here.'
            }
          }
        })())

        this.sql.prepare(/*sql*/`
        ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO lesson
        (${Object.keys(lessonItem).map(safeColumnName)})
        VALUES (${Object.keys(lessonItem).map((c) => `@${c}`)})
        ON CONFLICT DO NOTHING
        `).run(lessonItem)

        const deckItem = removeNull({
          uid: nanoid(),
          name: el.deck,
          lessonId
        })

        this.sql.prepare(/*sql*/`
        ${el.onConflict === 'overwrite' ? 'REPLACE' : 'INSERT'} INTO deck
        (${Object.keys(deckItem).map(safeColumnName)})
        VALUES (${Object.keys(deckItem).map((c) => `@${c}`)})
        ON CONFLICT DO NOTHING
        `).run(deckItem)

        if (el.cardIds) {
          const { deckId, set_cardId } = this.sql.prepare(/*sql*/`
          SELECT [uid] deckId, set_cardId FROM deck
          WHERE [name] = @name AND lessonId = @lessonId
          `).get({ name: el.deck, lessonId })

          const existingCardIds = new Set(this.types.set.toNative(set_cardId))
          const newCardIds = el.cardIds || []

          if (newCardIds.some((cid) => existingCardIds.has(cid))) {
            newCardIds.map((cid) => existingCardIds.add(cid))

            this.sql.prepare(/*sql*/`
            UPDATE deck
            SET set_cardId = ?
            WHERE [uid] = ?
            `).run([
              this.types.set.toSql(Array.from(existingCardIds)),
              deckId
            ])
          }
        }

        idsMap.set(lessonId, el)
      })

      this.sql.pragma('read_uncommitted=off;')
    })()

    return idsMap
  }

  import (filename: string) {
    return new Observable<{
      message: string
    }>((obs) => {
      obs.next({
        message: `Opening: ${filename}`
      })
      const srcDb = new DbSqlite(filename)
      DbSqlite.replicate(srcDb, this)
        .subscribe(
          obs.next,
          obs.error,
          obs.complete
        )
    })
  }

  export (
    q: string | Record<string, any>, filename: string
  ) {
    return new Observable<{
      message: string
      percent?: number
    }>((obs) => {
      const uids = new Set<string>()

      obs.next({
        message: 'Querying'
      })
      const rCard = this.query(q, {
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
        this.sql.prepare(/*sql*/`
        SELECT q.uid quizId
        FROM [card] c
        JOIN quiz q ON q.cardId = c.uid
        WHERE cardId = @cardId
        `).all({ cardId: uid }).map(({ quizId }) => {
          uids.add(quizId)
        })

        this.sql.prepare(/*sql*/`
        SELECT d.uid deckId, ls.uid lessonId
        FROM deck d
        JOIN lesson ls ON d.lessonId = ls.uid
        WHERE ls.name = @lesson AND d.name = @deck
        `).all({ lesson, deck }).map(({ deckId, lessonId }) => {
          uids.add(deckId)
          uids.add(lessonId)
        })
      })

      obs.next({
        message: 'Creating destination database'
      })
      const dstDb = new DbSqlite(filename)

      DbSqlite.replicate(this, dstDb, Array.from(uids))
        .subscribe(
          obs.next,
          obs.error,
          obs.complete
        )
    })
  }

  importAnki2 (filename: string, meta: {
    originalFilename?: string
  } = {}) {
    return new Observable<{
      message: string
      percent?: number
    }>((obs) => {
      obs.next({
        message: `Opening ${filename} as SQLite database`
      })
      const srcDb = sqlite3(filename)

      obs.next({
        message: 'Creating additional tables'
      })
      srcDb.exec(/*sql*/`
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
        mid     INTEGER NOT NULL, --  REFERENCES models(id)
        ord     INTEGER NOT NULL,
        [name]  TEXT NOT NULL,
        qfmt    TEXT NOT NULL,
        afmt    TEXT
      );
      `)

      obs.next({
        message: 'Filling additional tables with JSON data from table: col'
      })

      srcDb.transaction(() => {
        const { decks, models } = srcDb.prepare(/*sql*/`
          SELECT decks, models FROM col
        `).get()

        Object.values(JSON.parse(decks)).map((d: any) => {
          srcDb.prepare(/*sql*/`
          INSERT INTO decks (id, [name]) VALUES (?, ?)
          `).run([parseInt(d.id), d.name])
        })

        Object.values(JSON.parse(models)).map((m: any) => {
          srcDb.prepare(/*sql*/`
          INSERT INTO models (id, [name], flds, css)
          VALUES (?, ?, ?, ?)
        `).run([parseInt(m.id), m.name, m.flds.map((f: any) => f.name).join('\x1f'), m.css])

          m.tmpls.map((t: any, i: number) => {
            srcDb.prepare(/*sql*/`
            INSERT INTO templates (mid, ord, [name], qfmt, afmt)
            VALUES (?, ?, ?, ?, ?)
          `).run([parseInt(m.id), i, t.name, t.qfmt, t.afmt])
          })
        })
      })()

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

      const allAnkiCards = srcDb.prepare(/*sql*/`
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
      LEFT JOIN notes AS n ON c.nid = n.id
      LEFT JOIN decks AS d ON c.did = d.id
      LEFT JOIN models AS m ON n.mid = m.id
      LEFT JOIN templates AS t ON t.ord = c.ord AND t.mid = n.mid
    `).all().map((el) => {
        const ks: string[] = el.keys.split('\x1f').map((k: string) => slugify(k))
        const vs: string[] = el.values.split('\x1f')
        const data: Record<string, string> = {}
        ks.map((k, i) => { data[k] = vs[i] })

        const keyData = 'data_' + ser.hash(data)
        const keyAnki = slugify(`anki_${el.model}_${el.template}_${keyData}`)

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

      srcDb.close()

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

        const cardIdMap = this.insertCardQuiz(...cs.map(({
          keyData,
          keyCss,
          keyAnki,
          data,
          qfmt,
          afmt,
          css
        }) => {
          const cs: InsertCardQuizItem[] = [
            {
              onConflict: 'ignore',
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

        this.insertLessonDeck(...cs.map(({
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
    })
  }

  insert (...entries: InsertItem[]) {
    const cardEntries = entries.map(({
      onConflict, key, markdown, data, tag, ref, media, srsLevel, nextReview, stat
    }) => ({
      onConflict, key, markdown, data, tag, ref, media, srsLevel, nextReview, stat
    }))

    const rCard = this.insertCardQuiz(...cardEntries)
    const cardKeyToIdMap = new Map(Array.from(rCard)
      .map(([k, v]) => [v.key!, k]))

    const lessonEntries = entries.map(({
      lessonKey, lesson, lessonDescription, deck, key
    }) => {
      const cardId = cardKeyToIdMap.get(key!)
      if (cardId) {
        return {
          onConflict: 'ignore' as OnConflict,
          lessonKey,
          lesson,
          lessonDescription,
          deck,
          cardIds: [cardId]
        }
      }
      return null
    }).filter((el) => el).map((el) => el!)

    this.insertLessonDeck(...lessonEntries)

    return cardKeyToIdMap
  }

  update (keys: string[], set: UpdateItem) {
    validate('schema.json#/definitions/NonEmptyArray', keys)
    const {
      key, markdown, data, tag, ref, media,
      srsLevel, nextReview, stat,
      lessonKey, lesson, lessonDescription,
      deck
    } = validate('schema.json#/definitions/InsertItem', set)

    this.sql.transaction(() => {
      this.sql.pragma('read_uncommited=on;')

      const cardIds: string[] = []

      if ([data, tag, ref, media].some((el) => typeof el !== 'undefined')) {
        keys.map((k) => {
          let newData = {
            dict_data: data as any,
            set_tag: tag as any,
            set_ref: ref as any,
            set_media: media as any
          }

          const { uid, dict_data, set_tag, set_ref, set_media } = this.sql.prepare(/*sql*/`
          SELECT [uid], ${Object.keys(newData).map(safeColumnName)} FROM [card]
          WHERE [key] = @key
          `).get({ key: k })

          cardIds.push(uid)

          let newDictData: Record<string, any> | undefined
          if (data) {
            newDictData = deepMerge(this.types.dict.toNative(dict_data) || {}, data)
          }

          let newSetTag: Set<string> | undefined
          if (tag) {
            newSetTag = new Set(this.types.set.toNative(set_tag) || [])
            tag.map((t) => t ? newSetTag!.add(t) : null)
          }

          let newSetRef: Set<string> | undefined
          if (ref) {
            newSetRef = new Set(this.types.set.toNative(set_ref) || [])
            ref.map((r) => r ? newSetRef!.add(r) : null)
          }

          let newSetMedia: Set<string> | undefined
          if (media) {
            newSetMedia = new Set(this.types.set.toNative(set_media) || [])
            media.map((m) => m ? newSetMedia!.add(m) : null)
          }

          newData = removeNull({
            dict_data: this.types.dict.toSql(newDictData),
            set_tag: this.types.set.toSql(newSetTag),
            set_ref: this.types.set.toSql(newSetRef),
            set_media: this.types.set.toSql(newSetMedia)
          })

          this.sql.prepare(/*sql*/`
          UPDATE [card]
          SET ${Object.keys(newData).map((k) => `${safeColumnName(k)} = @${k}`)}
          WHERE [uid] = @uid
          `).run({
            ...newData,
            uid
          })
        })
      }

      if (cardIds.length === 0) {
        for (const ks of chunks(keys, 900)) {
          this.sql.prepare(/*sql*/`
          SELECT [uid] FROM [card] WHERE [key] IN (${Array(ks.length).fill('?')})
          `).all(ks).map((r) => cardIds.push(r.uid))
        }
      }

      if ([key, markdown].some((t) => typeof t !== 'undefined')) {
        const update = { key, markdown }

        for (const ids of chunks(cardIds, 900)) {
          const params = Object.values(update) as any[]
          params.push(...ids)

          this.sql.prepare(/*sql*/`
          UPDATE [card]
          SET ${Object.keys(update).map((c) => `${safeColumnName(c)} = ?`)}
          WHERE [uid] IN (${Array(ids.length).fill('?')})
          `).run(params)
        }
      }

      if ([srsLevel, nextReview].some((t) => typeof t !== 'undefined')) {
        const update = ser.clone({ srsLevel, date_nextReview: this.types.date.toSql(nextReview) || undefined })

        for (const ids of chunks(cardIds, 900)) {
          const params = Object.values(update) as any[]
          params.push(...ids)

          this.sql.prepare(/*sql*/`
          UPDATE quiz
          SET ${Object.keys(update).map((c) => `${safeColumnName(c)} = ?`)}
          WHERE cardId IN (${Array(ids.length).fill('?')})
          `).run(params)
        }
      }

      if (stat) {
        for (const ids of chunks(cardIds, 900)) {
          const params = [this.types.dict.toSql(stat)]
          params.push(...ids)

          this.sql.prepare(/*sql*/`
          UPDATE quiz
          SET dict_stat = json_patch(dict_stat, ?)
          WHERE cardId IN (${Array(ids.length).fill('?')})
          `).run(params)
        }
      }

      let lessonId: string | null = null
      let isNewLesson = false
      if (lessonKey) {
        const ls = this.sql.prepare(/*sql*/`
        SELECT [uid] FROM lesson WHERE [key] = ?
        `).get([lessonKey])

        if (ls) {
          lessonId = ls.uid
        } else if (lesson) {
          lessonId = nanoid()

          const newLesson = {
            uid: lessonId,
            key: lessonKey,
            name: lesson,
            description: lessonDescription
          }
          isNewLesson = true

          this.sql.prepare(/*sql*/`
          INSERT INTO lesson (${Object.keys(newLesson).map(safeColumnName)})
          VALUES (${Object.keys(newLesson).map((c) => `@${c}`)})
          `).run(newLesson)
        }
      }

      if (!isNewLesson && [lessonKey, lesson, lessonDescription].some((t) => typeof t !== 'undefined')) {
        const update = ser.clone({ key: lessonKey, name: lesson, description: lessonDescription })

        this.sql.prepare(/*sql*/`
        UPDATE lesson
        SET ${Object.keys(update).map((c) => `${safeColumnName(c)} = @c`)}
        WHERE [uid] = @lessonId
        `).run({
          ...update,
          lessonId
        })
      }

      if (lessonId && deck) {
        const d = this.sql.prepare(/*sql*/`
        SELECT set_cardId FROM deck
        WHERE lessonId = @lessonId AND [name] = @deck
        `).get({ lessonId, deck })

        if (d) {
          const setCardId = new Set(this.types.set.toNative(d.set_cardId))
          keys.map((k) => setCardId.add(k))

          this.sql.prepare(/*sql*/`
          UPDATE deck
          SET set_cardId = @set_cardId
          WHERE lessonId = @lessonId AND [name] = @deck
          `).run({
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

          this.sql.prepare(/*sql*/`
          INSERT INTO deck (${Object.keys(newDeck).map(safeColumnName)})
          VALUES (${Object.keys(newDeck).map((c) => `@${c}`)})
          `).run(newDeck)
        }
      }

      this.sql.pragma('read_uncommited=off;')
    })
  }

  delete (...keys: string[]) {
    this.sql.transaction(() => {
      const cardIds: string[] = []

      for (const ks of chunks(keys, 900)) {
        this.sql.prepare(/*sql*/`
        SELECT [uid] FROM [card]
        WHERE [key] IN (${Array(ks.length).fill('?')})
        `).all(ks).map((r) => {
          cardIds.push(r.uid)
        })
      }

      const decks = this.sql.prepare(/*sql*/`
      SELECT [uid], set_cardId FROM deck
      `).all().map((d) => {
        const setCardId = new Set(this.types.set.toNative(d.set_cardId))
        cardIds.map((id) => setCardId.delete(id))

        return {
          uid: d.uid,
          set_cardId: this.types.set.toSql(setCardId)
        }
      })

      for (const ids of chunks(cardIds, 900)) {
        this.sql.prepare(/*sql*/`
        DELETE FROM [card]
        WHERE [uid] IN (${Array(ids.length).fill('?')})
        `).run(ids)

        this.sql.prepare(/*sql*/`
        DELETE FROM quiz
        WHERE cardId IN (${Array(ids.length).fill('?')})
        `).run(ids)
      }

      for (const ds of decks.filter((d) => d.set_cardId)) {
        this.sql.prepare(/*sql*/`
        UPDATE deck
        SET set_cardId = @set_cardId
        WHERE [uid] = @uid
        `).run(ds)
      }

      for (const ids of chunks(
        decks.filter((d) => !d.set_cardId).map((d) => d.uid),
        900
      )) {
        this.sql.prepare(/*sql*/`
        DELETE FROM deck
        WHERE [uid] IN (${Array(ids.length).fill('?')})
        `).run(ids)
      }
    })
  }

  renderMin (key: string) {
    const r = this.sql.prepare(/*sql*/`
    SELECT [key], dict_data, markdown, set_ref, set_media
    FROM [card]
    WHERE [key] = ?
    `).get([key])

    if (r) {
      return validate<RenderItemMin>('schema.json#/definitions/RenderItemMin', removeNull({
        key: r.key,
        data: this.types.dict.toNative(r.dict_data),
        ref: this.types.set.toNative(r.set_ref),
        media: this.types.set.toNative(r.set_media),
        markdown: r.markdown
      }))
    }

    return null
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  _updateSrsLevel (dSrsLevel: number) {
    return (key: string) => {
      const d = this.sql.prepare(/*sql*/`
      SELECT srsLevel, dict_stat, q.uid [uid]
      FROM quiz q
      JOIN [card] c ON c.uid = q.cardId
      WHERE c.key = ?
      `).get([key])

      let srsLevel = 0
      let stat = {
        streak: {
          right: 0,
          wrong: 0,
          maxRight: 0,
          maxWrong: 0
        }
      }
      let nextReview = +repeatReview()

      if (d) {
        srsLevel = d.srsLevel
        stat = this.types.dict.toNative(d.dict_stat)
      }

      if (dSrsLevel > 0) {
        stat = dotProp.set(stat, 'streak.right', dotProp.get(stat, 'streak.right', 0) + 1)
        stat = dotProp.set(stat, 'streak.wrong', 0)
        stat = dotProp.set(stat, 'lastRight', new Date().toISOString())

        if (dotProp.get(stat, 'streak.right', 1) > dotProp.get(stat, 'streak.maxRight', 0)) {
          stat = dotProp.set(stat, 'streak.maxRight', dotProp.get(stat, 'streak.right', 1))
        }
      } else if (dSrsLevel < 0) {
        stat = dotProp.set(stat, 'streak.wrong', dotProp.get(stat, 'streak.wrong', 0) + 1)
        stat = dotProp.set(stat, 'streak.right', 0)
        stat = dotProp.set(stat, 'lastWrong', new Date().toISOString())

        if (dotProp.get(stat, 'streak.wrong', 1) > dotProp.get(stat, 'streak.maxWrong', 0)) {
          stat = dotProp.set(stat, 'streak.maxWrong', dotProp.get(stat, 'streak.wrong', 1))
        }
      }

      srsLevel += dSrsLevel

      if (srsLevel >= srsMap.length) {
        srsLevel = srsMap.length - 1
      }

      if (srsLevel < 0) {
        srsLevel = 0
      }

      if (dSrsLevel > 0) {
        nextReview = +getNextReview(srsLevel)
      }

      if (!d) {
        const newQuiz = {
          quizId: nanoid(),
          key,
          srsLevel,
          date_nextReview: nextReview,
          dict_stat: this.types.dict.toSql(stat)
        }

        this.sql.prepare(/*sql*/`
        INSERT INTO quiz ([uid], cardId, srsLevel, date_nextReview, dict_stat)
        VALUES (
          @quizId,
          (SELECT [uid] FROM [card] WHERE [key] = @key),
          @srsLevel, @date_nextReview, @dict_stat
        )
        `).run(newQuiz)
      } else {
        this.sql.prepare(/*sql*/`
        UPDATE quiz
        SET
          dict_stat = ?,
          date_nextReview = ?,
          srsLevel = ?
        WHERE [uid] = ?
        `).run([
          this.types.dict.toSql(stat),
          nextReview,
          srsLevel,
          d.uid
        ])
      }
    }
  }

  insertMedia (file: UploadedFile, key?: string) {
    const uid = nanoid()
    key = key || uid

    this.sql.prepare(/*sql*/`
    INSERT INTO media ([uid], [key], [name], mimetype, [data])
    VALUES (?, ?, ?, ?, ?)
    `).run([uid, key, file.name, file.mimetype, file.data])

    return key
  }

  getMedia (key: string) {
    const m = this.sql.prepare(/*sql*/`
    SELECT [name], mimetype, [data], dict_meta FROM media
    WHERE [key] = ?
    `).get([key])

    if (m) {
      m.meta = this.types.dict.toNative(m.dict_meta)
      delete m.dict_meta
      return m
    }

    return null
  }

  allLesson () {
    return this.sql.prepare(/*sql*/`
    SELECT [key], [name], [description]
    FROM lesson
    `).all()
  }

  allDeck (lesson: string) {
    return this.sql.prepare(/*sql*/`
    SELECT d.name deck
    FROM deck d
    JOIN lesson ls ON ls.uid = d.lessonId
    WHERE ls.name = ?
    `).all([lesson]).map((d) => d.deck)
  }

  allTag () {
    return Array.from<string>(this.sql.prepare(/*sql*/`
    SELECT set_tag FROM [card]
    `).all().reduce((prev, r) => {
      (this.types.set.toNative(r.set_tag) || []).map((t) => prev.add(t))
      return prev
    }, new Set())).sort()
  }

  addTag (keys: string[], tags: string[]) {
    this.sql.transaction(() => {
      for (const k of keys) {
        const c = this.sql.prepare(/*sql*/`
        SELECT set_tag FROM [card] WHERE [key] = ?
        `).get([k])

        if (c) {
          const setTag = new Set(this.types.set.toNative(c.set_tag))
          const originalLength = setTag.size
          tags.map((t) => setTag.add(t))

          if (setTag.size !== originalLength) {
            this.sql.prepare(/*sql*/`
            UPDATE [card]
            SET set_tag = ?
            WHERE [key] = ?
            `).run([
              this.types.set.toSql(setTag),
              k
            ])
          }
        }
      }
    })()
  }

  removeTag (keys: string[], tags: string[]) {
    this.sql.transaction(() => {
      for (const k of keys) {
        const c = this.sql.prepare(/*sql*/`
        SELECT set_tag FROM [card] WHERE [key] = ?
        `).get([k])

        if (c) {
          const setTag = new Set(this.types.set.toNative(c.set_tag))
          if (tags.map((t) => setTag.delete(t)).some((r) => r)) {
            this.sql.prepare(/*sql*/`
            UPDATE [card]
            SET set_tag = ?
            WHERE [key] = ?
            `).run([
              this.types.set.toSql(setTag),
              k
            ])
          }
        }
      }
    })()
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
