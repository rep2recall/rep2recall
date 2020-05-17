import crypto from 'crypto'

import { nanoid } from 'nanoid'
import dotProp from 'dot-prop-immutable'
import { Observable } from 'observable-fns'
import { Serialize } from 'any-serialize'
import { UploadedFile } from 'express-fileupload'
import sqlite3 from 'better-sqlite3'
import MulticastSubject from 'observable-fns/dist/subject'

import { removeNull, slugify, chunks, deepMerge } from '../util'
import { repeatReview, srsMap, getNextReview } from './quiz'
import { defaultDbStat } from './defaults'
import { validate } from '../schema/ajv'
import { QueryItem, QueryItemPartial, InsertCardQuizItem, InsertLessonDeckItem, InsertItem, OnConflict, UpdateItem, RenderItemMin, DbCard, DbDeck } from '../schema/schema'
import { QSearch, safeColumnName } from './sql-util'

const ser = new Serialize()

export class DbSqlite {
  qSearch = new QSearch({
    anyOf: ['key', 'tag', 'lesson', 'deck'],
    schema: {
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
        return s ? JSON.parse(s) : undefined
      }
    },
    date: {
      toSql (a: any) {
        return a ? new Date(a).toISOString() : null
      },
      toNative (s?: number) {
        return s ? new Date(s) : undefined
      }
    },
    set: {
      toNative (s?: string) {
        return s ? JSON.parse(s) : undefined
      }
    }
  }

  sql: sqlite3.Database

  constructor (
    public filename: string,
    isOptimized?: boolean
  ) {
    // super()
    this.sql = sqlite3(filename)

    if (isOptimized) {
      this.sql.pragma('journal_mode=WAL')
    }

    // if (!this.hasTable()) {
    this.init()
    // }
  }

  // private hasTable () {
  //   return !!this.sql.prepare(/*sql*/`
  //   SELECT * FROM sqlite_master WHERE type='table' LIMIT 1
  //   `).get()
  // }

  private init () {
    this.sql.exec(/*sql*/`
    CREATE TABLE IF NOT EXISTS [card] (
      [uid]         TEXT PRIMARY KEY,
      date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      date_updated  TEXT,
      date_sync     TEXT,
      [key]         TEXT NOT NULL UNIQUE,
      markdown      TEXT,
      dict_data     TEXT
      -- set_media     TEXT,
      -- set_ref       TEXT,
      -- set_tag       TEXT
    );

    CREATE TRIGGER IF NOT EXISTS card_on_update
      AFTER UPDATE ON [card]
      WHEN
        OLD.date_created <> NEW.date_created OR
        OLD.date_updated <> NEW.date_updated OR
        OLD.date_sync <> NEW.date_sync
    BEGIN
      UPDATE [card]
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.uid;
    END;

    CREATE TABLE IF NOT EXISTS quiz (
      [uid]           TEXT PRIMARY KEY,
      date_created    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      date_updated    TEXT,
      date_sync       TEXT,
      cardId          TEXT NOT NULL,
      srsLevel        INTEGER NOT NULL DEFAULT 0,
      date_nextReview TEXT NOT NULL,
      dict_stat       TEXT NOT NULL DEFAULT '${JSON.stringify(defaultDbStat)}'
    );

    CREATE TRIGGER IF NOT EXISTS quiz_on_update
      AFTER UPDATE ON quiz
      WHEN
        OLD.date_created <> NEW.date_created OR
        OLD.date_updated <> NEW.date_updated OR
        OLD.date_sync <> NEW.date_sync
    BEGIN
      UPDATE quiz
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.uid;
    END;

    CREATE INDEX IF NOT EXISTS quiz_cardId_idx ON quiz(cardId);

    CREATE TABLE IF NOT EXISTS lesson (
      [uid]         TEXT PRIMARY KEY,
      date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      date_updated  TEXT,
      date_sync     TEXT,
      [key]         TEXT NOT NULL UNIQUE,
      [name]        TEXT NOT NULL,
      [description] TEXT
    );

    CREATE TRIGGER IF NOT EXISTS lesson_on_update
      AFTER UPDATE ON lesson
      WHEN
        OLD.date_created <> NEW.date_created OR
        OLD.date_updated <> NEW.date_updated OR
        OLD.date_sync <> NEW.date_sync
    BEGIN
      UPDATE lesson
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.uid;
    END;

    CREATE TABLE IF NOT EXISTS deck (
      [uid]         TEXT PRIMARY KEY,
      date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      date_updated  TEXT,
      date_sync     TEXT,
      [name]        TEXT NOT NULL,
      lessonId      TEXT NOT NULL,
      -- set_cardId    TEXT,
      UNIQUE ([name], lessonId)
    );

    CREATE TRIGGER IF NOT EXISTS deck_on_update
      AFTER UPDATE ON deck
      WHEN
        OLD.date_created <> NEW.date_created OR
        OLD.date_updated <> NEW.date_updated OR
        OLD.date_sync <> NEW.date_sync
    BEGIN
      UPDATE deck
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.uid;
    END;

    CREATE INDEX IF NOT EXISTS deck_lessonId_idx ON deck(lessonId);

    CREATE TABLE IF NOT EXISTS media (
      [uid]         TEXT PRIMARY KEY,
      date_created  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      date_updated  TEXT,
      date_sync     TEXT,
      [key]         TEXT NOT NULL UNIQUE,
      [name]        TEXT NOT NULL,
      mimetype      TEXT,
      [data]        BLOB,
      dict_meta     TEXT
    );

    CREATE TRIGGER IF NOT EXISTS media_on_update
      AFTER UPDATE ON media
      WHEN
        OLD.date_created <> NEW.date_created OR
        OLD.date_updated <> NEW.date_updated OR
        OLD.date_sync <> NEW.date_sync
    BEGIN
      UPDATE media
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.uid;
    END;

    -- Relationship (sets, i.e. o2m) --

    CREATE TABLE IF NOT EXISTS card_media (
      cardId        TEXT NOT NULL REFERENCES [card]([uid]) ON DELETE CASCADE,
      mediaId       TEXT NOT NULL REFERENCES media([uid]) ON DELETE CASCADE,
      PRIMARY KEY (cardId, mediaId)
    );

    CREATE TRIGGER IF NOT EXISTS card_media_on_insert
      AFTER INSERT ON card_media
    BEGIN
      UPDATE [card]
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.cardId;
    END;

    CREATE TRIGGER IF NOT EXISTS card_media_on_delete
      AFTER DELETE ON card_media
    BEGIN
      UPDATE [card]
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = OLD.cardId;
    END;

    CREATE TABLE IF NOT EXISTS card_ref (
      cardId        TEXT NOT NULL REFERENCES [card]([uid]) ON DELETE CASCADE,
      refId         TEXT NOT NULL REFERENCES [card]([uid]) ON DELETE CASCADE,
      PRIMARY KEY (cardId, refId)
    );

    CREATE TRIGGER IF NOT EXISTS card_ref_on_insert
      AFTER INSERT ON card_ref
    BEGIN
      UPDATE [card]
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.cardId;
    END;

    CREATE TRIGGER IF NOT EXISTS card_ref_on_delete
      AFTER DELETE ON card_ref
    BEGIN
      UPDATE [card]
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = OLD.cardId;
    END;

    CREATE TABLE IF NOT EXISTS card_tag (
      cardId        TEXT NOT NULL REFERENCES [card]([uid]) ON DELETE CASCADE,
      tag           TEXT NOT NULL,
      PRIMARY KEY (cardId, tag)
    );

    CREATE TRIGGER IF NOT EXISTS card_tag_on_insert
      AFTER INSERT ON card_tag
    BEGIN
      UPDATE [card]
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = NEW.cardId;
    END;

    CREATE TRIGGER IF NOT EXISTS card_tag_on_delete
      AFTER DELETE ON card_tag
    BEGIN
      UPDATE [card]
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = OLD.cardId;
    END;

    CREATE TABLE IF NOT EXISTS deck_card (
      deckId        TEXT NOT NULL REFERENCES deck([uid]) ON DELETE CASCADE,
      cardId        TEXT NOT NULL REFERENCES [card]([uid]) ON DELETE CASCADE,
      PRIMARY KEY (deckId, cardId)
    );

    CREATE TRIGGER IF NOT EXISTS deck_card_on_insert
      AFTER INSERT ON deck_card
    BEGIN
      UPDATE deck
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE deck = NEW.deckId;
    END;

    CREATE TRIGGER IF NOT EXISTS deck_card_on_delete
      AFTER DELETE ON deck_card
    BEGIN
      UPDATE deck
      SET date_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE [uid] = OLD.deckId;
    END;
    `)
  }

  rCardExport (ids?: Observable<string>) {
    return new Observable<{
      value: DbCard
      type: 'card'
    }>((obs) => {
      const pushStack = (ids?: string[]) => {
        if (ids && ids.length === 0) {
          return
        }

        for (const row of this.sql.prepare(/*sql*/`
        SELECT
          [uid],
          date_created,
          date_updated,
          [key],
          markdown,
          dict_data,
          json_group_array(cm.mediaId)  set_media,
          json_group_array(cr.refId)    set_ref,
          json_group_array(ct.tag)      set_tag
        FROM [card]  c
        LEFT JOIN card_media cm ON c.uid = cm.cardId
        LEFT JOIN card_ref   cr ON c.uid = cr.cardId
        LEFT JOIN card_tag   ct ON c.uid = ct.tag
        ${ids ? /*sql*/`
        WHERE c.uid IN (${Array(ids.length).fill('?')})
        GROUP BY c.uid
        ` : ''}
        `).iterate(ids)) {
          obs.next({
            value: validate('schema.json#/definitions/DbCard', this.normalizeRow(row)),
            type: 'card'
          })
        }
      }

      if (ids) {
        let currentStack: string[] = []

        ids.subscribe(
          (id) => {
            if (currentStack.length < 900) {
              currentStack.push(id)
            } else {
              pushStack(currentStack)
              currentStack = []
            }
          },
          obs.error,
          () => {
            pushStack(currentStack)
            obs.complete()
          }
        )
      } else {
        pushStack()
        obs.complete()
      }
    })
  }

  rCardImport (items: MulticastSubject<{ value: DbCard }>) {
    const pushedIds = new Set<string>()
    const getDateStmt = this.sql.prepare(/*sql*/`
    SELECT date_created, date_updated FROM [card]
    WHERE [uid] = @cardId
    `)
    const now = new Date().toISOString()

    return new Observable<{
      type: 'card'
      progress: number
      meta?: any
    }>((obs) => {
      items.subscribe(
        ({ value: c }) => {
          if (!pushedIds.has(c.uid)) {
            pushedIds.add(c.uid)

            const oldC = getDateStmt.get({ cardId: c.uid })
            if (oldC) {
              const { date_created, date_updated } = oldC
              const oldCardUpdated = Math.max(...[date_created, date_updated].map((d) => d ? +new Date(d) : 0))
              const newCardUpdated = Math.max(...[c.created, c.updated].map((d) => d ? +new Date(d) : 0))
              if (newCardUpdated > oldCardUpdated) {
                const update = {
                  // uid: c.uid,
                  key: c.key,
                  markdown: c.markdown,
                  dict_data: this.types.dict.toSql(c.data),
                  date_sync: now
                }

                this.sql.prepare(/*sql*/`
                UPDATE [card]
                SET ${Object.keys(update).map((c) => `${safeColumnName(c)} = @${c}`)}
                WHERE [uid] = @uid
                `).run({
                  ...update,
                  uid: c.uid
                })
              }
            }
          }
        },
        obs.error,
        obs.complete
      )
    })
  }

  rDeckExport (ids?: Observable<string>) {
    return new Observable<{
      value: DbDeck
      type: 'deck'
    }>((obs) => {
      const cardStmt = this.sql.prepare(/*sql*/`
      SELECT cardId id FROM deck_card WHERE deckId = @deckId
      `)

      const pushStack = (ids?: string[]) => {
        for (const row of this.sql.prepare(/*sql*/`
        SELECT * FROM deck
        ${ids ? `WHERE [uid] IN (${Array(ids.length).fill('?')})` : ''}
        `).iterate(ids)) {
          const { uid: deckId } = row
          row.card = cardStmt.all({ deckId }).map((r) => r.id)

          obs.next({
            value: validate('schema.json#/definitions/DbDeck', row),
            type: 'deck'
          })
        }
      }

      if (ids) {
        let currentStack: string[] = []

        ids.subscribe(
          (id) => {
            if (currentStack.length < 900) {
              currentStack.push(id)
            } else {
              pushStack(currentStack)
              currentStack = []
            }
          },
          obs.error,
          () => {
            pushStack(currentStack)
            obs.complete()
          }
        )
      } else {
        pushStack()
        obs.complete()
      }
    })
  }

  normalizeRow (r: any) {
    r = removeNull(r)

    for (const k of Object.keys(r)) {
      const [k1, k2] = k.split('_')
      if (k2 && r[k]) {
        if (k1 === 'dict' || k1 === 'date' || k1 === 'set') {
          r[k2] = this.types[k1].toNative(r[k])
          delete r[k]
        }
      }
    }

    for (const k of ['stat.lastRight', 'stat.lastWrong']) {
      const v = dotProp.get(r, k)
      if (v) {
        r = dotProp.set(r, k, this.types.date.toNative(v))
      }
    }

    return r
  }

  get (key: string) {
    let r = this.sql.prepare(/*sql*/`
    SELECT
      c.uid         cardId,
      c.key         [key],
      c.markdown    markdown,
      c.dict_data   dict_data,
      ls.name       lesson,
      d.name        deck,
      q.date_nextReview   date_nextReview,
      q.srsLevel    srsLevel,
      q.dict_stat   dict_stat,
      json_group_array(cm.mediaId)  set_media,
      json_group_array(cr.refId)    set_ref,
      json_group_array(ct.tag)      set_tag
    FROM [card] c
    LEFT JOIN deck_card dc ON dc.cardId = c.uid
    LEFT JOIN deck      d  ON dc.deckId = d.uid
    LEFT JOIN lesson    ls ON d.lessonId = ls.uid
    LEFT JOIN quiz      q  ON q.cardId = c.uid
    LEFT JOIN card_media cm  ON cm.cardId = c.uid
    LEFT JOIN card_ref   cr  ON cr.cardId = c.uid
    LEFT JOIN card_tag   ct  ON ct.cardId = c.uid
    WHERE c.key = @key
    GROUP BY c.key
    `).get({ key })

    if (r) {
      r = this.normalizeRow(r)
      const { cardId } = r

      r.media = this.sql.prepare(/*sql*/`
      SELECT mediaId id FROM card_media WHERE cardId = @cardId
      `).all({ cardId }).map((r0) => r0.id)

      r.ref = this.sql.prepare(/*sql*/`
      SELECT refId id FROM card_ref WHERE cardId = @cardId
      `).all({ cardId }).map((r0) => r0.id)

      r.tag = this.sql.prepare(/*sql*/`
      SELECT tag FROM card_tag WHERE cardId = @cardId
      `).all({ cardId }).map((r0) => r0.tag)

      delete r.cardId

      return validate<QueryItem>('schema.json#/definitions/QueryItem', r)
    }

    return null
  }

  query (q: (string | Record<string, any>) | (string | Record<string, any>)[], opts: {
    offset?: number
    limit?: number
    sort?: string
    fields?: (keyof QueryItem | 'cardId' | 'quizId' | 'lessonId' | 'deckId')[]
  } = {}) {
    return new Observable<{
      value: QueryItemPartial & Partial<Record<'cardId' | 'quizId' | 'lessonId' | 'deckId', string>>
    }>((obs) => {
      let {
        offset = 0, limit, sort, fields: initFields = [
          // 'mediaId',
          'cardId', 'quizId', 'lessonId', 'deckId',
          'key', 'markdown', 'data', 'tag', 'ref', 'media',
          'lesson',
          'deck',
          'nextReview', 'srsLevel', 'stat'
        ]
      } = opts

      const { where = 'TRUE', fields: moreFields } = this.qSearch.parse(
        ...(Array.isArray(q) ? q : [q])
      )

      const fields = new Set([
        ...initFields,
        ...moreFields
      ])

      const joinNeeded = new Set<string>()

      if (fields.has('tag')) {
        joinNeeded.add('card_tag')
      }

      if (fields.has('ref')) {
        joinNeeded.add('card_ref')
      }

      if (fields.has('media')) {
        joinNeeded.add('card_media')
      }

      if (['lesson'].some((t) => fields.has(t as any))) {
        joinNeeded.add('lesson')
        joinNeeded.add('deck')
      }

      if (['deckId', 'deck', 'lessonId'].some((t) => fields.has(t))) {
        joinNeeded.add('deck')
      }

      if (['quizId', 'nextReview', 'srsLevel', 'stat'].some((t) => fields.has(t))) {
        joinNeeded.add('quiz')
      }

      let direction = 'asc'
      if (sort) {
        if (sort.startsWith('-')) {
          direction = 'desc'
          sort = sort.substr(1)
        }

        if (sort === 'lesson') {
          joinNeeded.add('lesson')
        }

        if (sort === 'deck') {
          joinNeeded.add('lesson')
          joinNeeded.add('deck')
        }

        if (['nextReview', 'srsLevel'].some((t) => sort === t)) {
          joinNeeded.add('quiz')
        }

        if (sort.startsWith('stat.')) {
          joinNeeded.add('quiz')
          sort = `json_extract(dict_stat, '$.${sort.replace(/^stat\./, '')}')`
        } else if (sort.startsWith('data.')) {
          sort = `json_extract(dict_data, '$.${sort.replace(/^data\./, '')}')`
        } else {
          sort = `[${sort}]`
        }
      }

      for (const row of this.sql.prepare(/*sql*/`
      SELECT ${[
        ...Array.from(fields).filter((f) => [
          'tag', 'ref', 'media'
        ].includes(f)).map(safeColumnName),
        fields.has('tag') ? 'json_group_array(tag) set_tag' : null,
        fields.has('ref') ? 'json_group_array(ref) set_ref' : null,
        fields.has('media') ? 'json_group_array(media) set_media' : null
      ].filter((el) => el)} FROM (
        SELECT
          ${joinNeeded.has('lesson') ? /*sql*/`
          ls.name       lesson,
          ` : ''}
          ${joinNeeded.has('deck') ? /*sql*/`
          d.name        deck,
          d.lessonId    lessonId,
          d.uid         deckId,
          ` : ''}
          ${joinNeeded.has('quiz') ? /*sql*/`
          q.date_nextReview   date_nextReview,
          q.srsLevel    srsLevel,
          q.dict_stat   dict_stat,
          q.uid         quizId,
          ` : ''}
          ${joinNeeded.has('card_tag') ? /*sql*/`
          ct.tag        tag,
          ` : ''}
          ${joinNeeded.has('card_ref') ? /*sql*/`
          cr.refId      ref,
          ` : ''}
          ${joinNeeded.has('card_media') ? /*sql*/`
          cm.mediaId    mediaId,
          ` : ''}
          c.uid         cardId,
          c.key         [key],
          c.markdown    markdown,
          c.dict_data   dict_data
        FROM [card] c
        ${joinNeeded.has('deck') ? /*sql*/`
        LEFT JOIN deck_card dc  ON dc.cardId = c.uid
        LEFT JOIN deck d        ON dc.deckId = d.uid
        ` : ''}
        ${joinNeeded.has('lesson') ? /*sql*/`
        LEFT JOIN lesson ls  ON d.lessonId = ls.uid
        ` : ''}
        ${joinNeeded.has('quiz') ? /*sql*/`
        LEFT JOIN quiz   q   ON q.cardId = c.uid
        ` : ''}
        ${joinNeeded.has('card_tag') ? /*sql*/`
        LEFT JOIN card_tag ct ON ct.cardId = ct.tag
        ` : ''}
        ${joinNeeded.has('card_ref') ? /*sql*/`
        LEFT JOIN card_ref cr ON cr.cardId = cr.refId
        ` : ''}
        ${joinNeeded.has('card_media') ? /*sql*/`
        LEFT JOIN card_media cr ON cr.cardId = cr.mediaId
        ` : ''}
        WHERE ${where}
        ${sort ? /*sql*/`
        ORDER BY ${sort} ${direction} NULLS LAST
        ` : 'ORDER BY c.date_created DESC'}
      ) GROUP BY cardId
      ${limit ? `LIMIT ${limit}` : ''}
      OFFSET ${offset}
      `).iterate()) {
        obs.next({
          value: this.normalizeRow(row)
        })
      }

      obs.complete()
    })
  }

  queryForIds (q: string | Record<string, any>) {
    return new Observable<string>((obs) => {
      const uids = new Set<string>()
      const emit = (uid: string) => {
        if (!uids.has(uid)) {
          uids.add(uid)
          obs.next(uid)
        }
      }

      this.query(q, {
        fields: ['cardId', 'ref', 'media', 'deckId', 'lessonId', 'quizId']
      }).subscribe(
        ({ value }) => {
          if (value) {
            const { cardId, ref, media, deckId, lessonId, quizId } = value

            if (ref) {
              ref.map((r) => emit(r))
            }
            if (media) {
              media.map((r) => emit(r))
            }
            [cardId, deckId, lessonId, quizId].map((id) => id ? emit(id) : null)
          }
        },
        obs.error,
        obs.complete
      )
    })
  }

  insertCardQuiz (...entries: InsertCardQuizItem[]) {
    entries = entries.map((el) => validate('schema.json#/definitions/InsertCardQuizItem', el))
    const idsMap = new Map<string, InsertCardQuizItem>()

    this.sql.transaction(() => {
      this.sql.pragma('read_uncommitted=on;')
      this.sql.pragma('foreign_keys=off;')

      entries.map((el) => {
        const uid = nanoid()
        const key = el.key || uid
        el.key = key

        const cardItem = ser.clone({
          uid,
          key,
          markdown: el.markdown,
          dict_data: this.types.dict.toSql(el.data)
          // set_tag: this.types.set.toSql(el.tag),
          // set_ref: this.types.set.toSql(el.ref),
          // set_media: this.types.set.toSql(el.media)
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

        if (el.tag) {
          const stmt = this.sql.prepare(/*sql*/`
          INSERT INTO card_tag (cardId, tag)
          VALUES (@cardId, @tag)
          ON CONFLICT DO NOTHING
          `)
          el.tag.map((tag) => stmt.run({ cardId, tag }))
        }

        if (el.media) {
          const stmt = this.sql.prepare(/*sql*/`
          INSERT INTO card_media (cardId, mediaId)
          VALUES (@cardId, @id)
          ON CONFLICT DO NOTHING
          `)
          el.media.map((id) => stmt.run({ cardId, id }))
        }

        if (el.ref) {
          const stmt = this.sql.prepare(/*sql*/`
          INSERT INTO card_ref (cardId, refId)
          VALUES (@cardId, @id)
          ON CONFLICT DO NOTHING
          `)
          el.ref.map((id) => stmt.run({ cardId, id }))
        }

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
      this.sql.pragma('foreign_keys=on;')
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
          const { deckId } = this.sql.prepare(/*sql*/`
          SELECT [uid] deckId FROM deck
          WHERE [name] = @name AND lessonId = @lessonId
          `).get({ name: el.deck, lessonId })

          const stmt = this.sql.prepare(/*sql*/`
          INSERT INTO deck_card (deckId, cardId)
          VALUES (@deckId, @cardId)
          ON CONFLICT DO NOTHING
          `)

          el.cardIds.map((cardId) => stmt.run({ deckId, cardId }))
        }

        idsMap.set(lessonId, el)
      })

      this.sql.pragma('read_uncommitted=off;')
    })()

    return idsMap
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
      key: newKey, markdown, data, tag, ref, media,
      srsLevel, nextReview, stat,
      lessonKey, lesson, lessonDescription,
      deck
    } = validate('schema.json#/definitions/InsertItem', set)

    this.sql.transaction(() => {
      this.sql.pragma('read_uncommited=on;')

      const cardIds: string[] = []

      if ([
        data, tag, ref, media,
        lessonKey, lesson, lessonDescription,
        deck
      ].some((el) => typeof el !== 'undefined')) {
        keys.map((oldKey) => {
          let newData = {
            dict_data: data as any
          }

          const { cardId, dict_data } = this.sql.prepare(/*sql*/`
          SELECT [uid] cardId, ${Object.keys(newData).map(safeColumnName)} FROM [card]
          WHERE [key] = @key
          `).get({ key: oldKey })

          cardIds.push(cardId)

          if (tag) {
            this.sql.prepare(/*sql*/`
            DELETE FROM card_tag
            WHERE cardId = @cardId
            `).run({ cardId })

            const stmt = this.sql.prepare(/*sql*/`
            INSERT INTO card_tag (cardId, tag)
            VALUES (@cardId, @t)
            `)

            tag.map((t) => t ? stmt.run({ cardId, t }) : null)
          }

          if (ref) {
            this.sql.prepare(/*sql*/`
            DELETE FROM card_ref
            WHERE cardId = @cardId
            `).run({ cardId })

            const stmt = this.sql.prepare(/*sql*/`
            INSERT INTO card_ref (cardId, refId)
            VALUES (@cardId, @id)
            `)

            ref.map((id) => id ? stmt.run({ cardId, id }) : null)
          }

          if (media) {
            this.sql.prepare(/*sql*/`
            DELETE FROM card_media
            WHERE cardId = @cardId
            `).run({ cardId })

            const stmt = this.sql.prepare(/*sql*/`
            INSERT INTO card_media (cardId, mediaId)
            VALUES (@cardId, @id)
            `)

            media.map((id) => id ? stmt.run({ cardId, id }) : null)
          }

          let newDictData: Record<string, any> | undefined
          if (data) {
            newDictData = deepMerge(this.types.dict.toNative(dict_data) || {}, data)
          }

          newData = removeNull({
            dict_data: this.types.dict.toSql(newDictData)
          })

          if (Object.keys(newData).length) {
            this.sql.prepare(/*sql*/`
            UPDATE [card]
            SET ${Object.keys(newData).map((k) => `${safeColumnName(k)} = @${k}`)}
            WHERE [uid] = @cardId
            `).run({
              ...newData,
              cardId
            })
          }
        })
      }

      if (cardIds.length === 0) {
        for (const ks of chunks(keys, 900)) {
          this.sql.prepare(/*sql*/`
          SELECT [uid] FROM [card] WHERE [key] IN (${Array(ks.length).fill('?')})
          `).all(ks).map((r) => cardIds.push(r.uid))
        }
      }

      if ([newKey, markdown].some((t) => typeof t !== 'undefined')) {
        const update = { key: newKey, markdown }

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
        const newDeck = removeNull({
          uid: nanoid(),
          name: deck,
          lessonId
        })

        this.sql.prepare(/*sql*/`
        INSERT INTO deck (${Object.keys(newDeck).map(safeColumnName)})
        VALUES (${Object.keys(newDeck).map((c) => `@${c}`)})
        ON CONFLICT DO NOTHING
        `).run(newDeck)

        const { deckId } = this.sql.prepare(/*sql*/`
        SELECT [uid] deckId FROM deck WHERE [name] = @deck AND lessonId = @lessonId
        `).get({ deck, lessonId })

        const stmt = this.sql.prepare(/*sql*/`
        INSERT INTO deck_card (deckId, cardId)
        VALUES (@deckId, @cardId)
        ON CONFLICT DO NOTHING
        `)

        cardIds.map((cardId) => stmt.run({ deckId, cardId }))
      }

      this.sql.pragma('read_uncommited=off;')
    })
  }

  delete (...keys: string[]) {
    this.sql.transaction(() => {
      for (const ks of chunks(keys, 900)) {
        this.sql.prepare(/*sql*/`
        DELETE FROM [card]
        WHERE [key] IN (${Array(ks.length).fill('?')})
        `).run(ks)
      }
    })
  }

  async renderMin (key: string) {
    return new Promise<RenderItemMin | null>((resolve, reject) => {
      this.query({ key }, {
        limit: 1,
        fields: ['key', 'data', 'ref', 'media', 'markdown']
      }).subscribe(
        ({ value: r }) => {
          if (r) {
            resolve(validate('schema.json#/definitions/RenderItemMin', {
              key: r.key!,
              ...r
            }))
          }
        },
        reject,
        () => resolve(null)
      )
    })
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
      let nextReview = repeatReview().toISOString()

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
        nextReview = getNextReview(srsLevel).toISOString()
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
          dict_stat = @stat,
          date_nextReview = @nextReview,
          srsLevel = @srsLevel
        WHERE [uid] = @quizId
        `).run({
          stat: this.types.dict.toSql(stat),
          nextReview,
          srsLevel,
          deckId: d.uid
        })
      }
    }
  }

  insertMedia (file: UploadedFile, key?: string) {
    key = key || crypto.createHash('sha256').update(file.data).digest('base64')

    const uid = nanoid()
    const newMedia = {
      uid,
      key,
      name: file.name,
      mimetype: file.mimetype,
      data: file.data
    }

    this.sql.prepare(/*sql*/`
    INSERT INTO media (${Object.keys(newMedia).map(safeColumnName)})
    VALUES (${Object.keys(newMedia).map((k) => `@${k}`)})
    `).run(newMedia)

    return key
  }

  getMedia (uid: string) {
    const m = this.sql.prepare(/*sql*/`
    SELECT [name], mimetype, [data], dict_meta FROM media
    WHERE [uid] = @uid
    `).get({ uid })

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
    return this.sql.prepare(/*sql*/`
    SELECT DISTINCT tag FROM card_tag
    `).all().map((ct) => ct.tag)
  }

  addTag (keys: string[], tags: string[]) {
    this.sql.transaction(() => {
      const stmt = this.sql.prepare(/*sql*/`
      INSERT INTO card_tag (cardId, tag)
      VALUES ((
        SELECT [uid] FROM [card] WHERE [key] = @key
      ), @tag)
      ON CONFLICT DO NOTHING
      `)

      for (const key of keys) {
        for (const tag of tags) {
          stmt.run({ key, tag })
        }
      }
    })()
  }

  removeTag (keys: string[], tags: string[]) {
    this.sql.transaction(() => {
      for (const ks of chunks(keys, 900)) {
        this.sql.prepare(/*sql*/`
        DELETE FROM card_tag
        WHERE cardId IN (
          SELECT [uid] FROM [card] WHERE [key] IN (${Array(ks.length).fill('?')})
        ) AND tag IN (${Array(tags.length).fill('?')})
        `).run([...ks, ...tags])
      }
    })()
  }
}
