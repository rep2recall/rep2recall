import crypto from 'crypto'

import sqlite3 from 'better-sqlite3'
import * as z from 'zod'
import dayjs from 'dayjs'
import dotProp from 'dot-prop'
import { UploadedFile } from 'express-fileupload'
import { Serialize } from 'any-serialize'

import { removeNull, chunks, deepMerge, slugify } from './util'
import { repeatReview, srsMap, getNextReview } from './quiz'
import QSearch from './qsearch'

const ser = new Serialize()

const zDateType = z.string().refine((d) => {
  return typeof d === 'string' && isNaN(d as any) && dayjs(d).isValid()
}, 'not a Date').nullable().optional()
const zPosInt = z.number().refine((i) => Number.isInteger(i) && i > 0, 'not positive integer')

export const zDbSchema = z.object({
  overwrite: z.boolean().optional(),
  ignoreErrors: z.boolean().optional(),
  deck: z.string().optional(),
  lesson: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    deck: z.string()
  })).optional(),
  key: z.string().optional(),
  data: z.record(z.any()).optional(),
  tag: z.array(z.string()).optional(),
  ref: z.array(z.string()).optional(),
  media: z.array(z.string()).optional(),
  markdown: z.string().optional(),
  nextReview: zDateType.optional(),
  srsLevel: zPosInt.nullable().optional(),
  stat: z.object({}).optional()
})

export type IDbSchema = z.infer<typeof zDbSchema>

export const dbSchema = {
  $id: 'https://rep2recall.net/schema/dbSchema.json',
  type: 'object',
  properties: {
    overwrite: { type: 'boolean' },
    ignoreErrors: { type: 'boolean' },
    deck: { type: 'string' },
    lesson: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          deck: { type: 'string' }
        }
      }
    },
    key: { type: 'string' },
    data: { type: 'object' },
    tag: { type: 'array', items: { type: 'string' } },
    ref: { type: 'array', items: { type: 'string' } },
    media: { type: 'array', items: { type: 'string' } },
    markdown: { type: 'string' },
    nextReview: { type: 'string', format: 'date-time' },
    srsLevel: { type: 'integer' },
    stat: { type: 'object' }
  }
}

export class Db {
  db: sqlite3.Database
  qSearch = new QSearch({
    dialect: 'native',
    schema: {
      deck: {},
      lesson: {},
      key: {},
      tag: {},
      nextReview: { type: 'date' },
      srsLevel: { type: 'number' },
      data: { isAny: false },
      'stat.streak.right': { type: 'number' },
      'stat.streak.wrong': { type: 'number' },
      'stat.streak.maxRight': { type: 'number' },
      'stat.streak.maxWrong': { type: 'number' },
      'stat.lastRight': { type: 'date' },
      'stat.lastWrong': { type: 'date' }
    }
  })

  constructor (public filename: string) {
    this.db = sqlite3(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('read_uncommitted = on;')

    this.db.exec(/*sql*/`
    CREATE TABLE IF NOT EXISTS user (
      id        INTEGER PRIMARY KEY,
      email     TEXT UNIQUE,
      [secret]  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS [card] (
      id            INTEGER PRIMARY KEY,
      [user_id]     INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      [key]         TEXT NOT NULL,
      [data]        TEXT DEFAULT '{}', -- json
      markdown      TEXT DEFAULT '',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ([user_id], [key])
      -- relation m2m media
      -- relation m2m tag
      -- relation m2m ref
      -- relation m2m lesson
      -- relation o2m quiz
    );

    CREATE TABLE IF NOT EXISTS media (
      id        INTEGER PRIMARY KEY,
      [name]    TEXT NOT NULL UNIQUE,
      mimetype  TEXT NOT NULL,
      [data]    BLOB,
      meta      TEXT DEFAULT '{}', -- json
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS card_media (
      card_id   INTEGER NOT NULL REFERENCES [card](id) ON DELETE CASCADE,
      media_id  INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      UNIQUE (card_id, media_id)
    );

    CREATE TABLE IF NOT EXISTS tag (
      id      INTEGER PRIMARY KEY,
      [name]  TEXT NOT NULL UNIQUE,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS card_tag (
      card_id   INTEGER NOT NULL REFERENCES [card](id) ON DELETE CASCADE,
      tag_id    INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
      UNIQUE (card_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS card_ref (
      card_id   INTEGER NOT NULL REFERENCES [card](id) ON DELETE CASCADE,
      child_id  INTEGER NOT NULL REFERENCES [card](id) ON DELETE CASCADE,
      UNIQUE (card_id, child_id)
    );

    CREATE TABLE IF NOT EXISTS lesson (
      id            INTEGER PRIMARY KEY,
      [name]        TEXT NOT NULL UNIQUE,
      [description] TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deck (
      id          INTEGER PRIMARY KEY,
      [name]      TEXT NOT NULL,
      lesson_id   INTEGER REFERENCES lesson(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ([name], lesson_id)
    );

    CREATE TABLE IF NOT EXISTS card_deck (
      card_id   INTEGER NOT NULL REFERENCES [card](id) ON DELETE CASCADE,
      deck_id   INTEGER NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
      UNIQUE (card_id, deck_id)
    );

    CREATE TABLE IF NOT EXISTS quiz (
      id          INTEGER PRIMARY KEY,
      card_id     INTEGER NOT NULL UNIQUE REFERENCES [card](id) ON DELETE CASCADE,
      next_review INTEGER NOT NULL, -- epoch seconds
      srs_level   INTEGER NOT NULL,
      stat        TEXT DEFAULT '{}', -- json
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `)
  }

  generateSecret () {
    return crypto.randomBytes(64).toString('base64')
  }

  signInOrCreate (email?: string): number {
    let u: any = null
    if (email) {
      u = this.db.prepare(/*sql*/`
      SELECT id FROM user WHERE email = ?
      `).get([email])
    } else {
      u = this.db.prepare(/*sql*/`
      SELECT id FROM user WHERE email IS NULL
      `).get()
    }

    if (u) {
      return u.id
    }

    const r = this.db.prepare(/*sql*/`
    INSERT INTO user (email, [secret])
    VALUES (?, ?)
    `).run([email, this.generateSecret()])

    return r.lastInsertRowid.valueOf() as number
  }

  signInWithSecret (email: string, secret: string): number | null {
    let u: any = null
    if (email) {
      u = this.db.prepare(/*sql*/`
      SELECT id FROM user WHERE email = ? AND [secret] = ?
      `).get([email, secret])
    } else {
      u = this.db.prepare(/*sql*/`
      SELECT id FROM user WHERE email IS NULL AND [secret] = ?
      `).get([secret])
    }

    return (u ? u.id : null) || null
  }

  getUser () {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    return this.db.prepare(/*sql*/`
    SELECT email, [secret]
    FROM user WHERE id = ?
    `).get([userId])
  }

  newSecret () {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    const s = this.generateSecret()

    this.db.prepare(/*sql*/`
    UPDATE user
    SET [secret] = ?
    WHERE id = ?
    `).run([s, userId])

    return s
  }

  close () {
    return this.db.close()
  }

  find (q: string | Record<string, any>, postfix?: string) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    if (typeof q === 'string') {
      q = this.qSearch.parse(q).cond as Record<string, any>
    }

    const result: IDbSchema[] = []
    const filterFunction = this.qSearch.filterFunction(q)

    const stmt = {
      getLesson: this.db.prepare(/*sql*/`
      SELECT ls.name [name], ls.description [description], d.name deck
      FROM deck d
      LEFT JOIN lesson ls ON d.lesson_id = ls.id
      JOIN card_deck cd ON cd.deck_id = d.id
      WHERE cd.card_id = ?
      `),
      getTag: this.db.prepare(/*sql*/`
      SELECT t.name [name]
      FROM tag t
      JOIN card_tag ct ON ct.tag_id = t.id
      WHERE ct.card_id = ?
      `),
      getRef: this.db.prepare(/*sql*/`
      SELECT c.key ref
      FROM card_ref cr
      JOIN [card] c ON cr.child_id = c.id
      WHERE card_id = ?
      `),
      getMedia: this.db.prepare(/*sql*/`
      SELECT m.name [name]
      FROM media m
      JOIN card_media cm ON cm.media_id = m.id
      WHERE cm.card_id = ?
      `),
      getQuiz: this.db.prepare(/*sql*/`
      SELECT srs_level srsLevel, next_review nextReview, stat
      FROM quiz
      WHERE card_id = ?
      `)
    }

    for (const r of this.db.prepare(/*sql*/`
    SELECT id, [key], [data], markdown FROM [card]
    WHERE [user_id] = ? ${postfix || ''}
    `).iterate(userId)) {
      r.lesson = stmt.getLesson.all([r.id])
      r.deck = r.lesson.filter((ls: any) => !ls.name).map((ls: any) => ls.deck)[0]

      r.tag = stmt.getTag.all([r.id]).map((t) => t.name)
      r.ref = stmt.getRef.all([r.id]).map((cr) => cr.ref)
      r.media = stmt.getMedia.all([r.id]).map((m) => m.name)

      Object.assign(r, stmt.getQuiz.get([r.id]) || {})

      r.stat = JSON.parse(r.stat || '{}')
      r.data = JSON.parse(r.data)
      r.nextReview = r.nextReview ? dayjs(r.nextReview).toISOString() : undefined

      if (!filterFunction(r)) {
        continue
      }

      result.push(r)
    }

    return result
  }

  insert (...entries: IDbSchema[]) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    entries = entries.map((el) => {
      return zDbSchema.parse(removeNull(el))
    })

    const cardIds: number[] = []
    this.db.pragma('foreign_keys = off;')

    const getCardId = this.db.prepare(/*sql*/`
    SELECT id FROM [card]
    WHERE [user_id] = ? AND [key] = ?
    `)

    this.db.transaction(() => {
      const insertTagIgnore = this.db.prepare(/*sql*/`
      INSERT INTO tag ([name]) VALUES (?)
      ON CONFLICT DO NOTHING
      `)

      for (const t of entries
        .map((el) => el.tag)
        .filter((ts) => ts)
        .reduce((prev, c) => [...prev!, ...c!], [])!
        .filter((c, i, arr) => arr.indexOf(c) === i)) {
        insertTagIgnore.run([t])
      }

      const insertDeckIgnore = this.db.prepare(/*sql*/`
      INSERT INTO deck ([name]) VALUES (?)
      ON CONFLICT DO NOTHING
      `)

      for (const d of entries
        .map((el) => el.deck)
        .filter((d) => d)
        .filter((c, i, arr) => arr.indexOf(c) === i)) {
        insertDeckIgnore.run([d])
      }

      const insertLessonIgnore = this.db.prepare(/*sql*/`
      INSERT INTO lesson ([name], [description]) VALUES (?, ?)
      ON CONFLICT DO NOTHING
      `)
      const insertLessonDeckIgnore = this.db.prepare(/*sql*/`
      INSERT INTO deck ([name], lesson_id) VALUES (?, (
        SELECT id FROM lesson WHERE [name] = ?
      ))
      ON CONFLICT DO NOTHING
      `)

      for (const ls of entries
        .map((el) => el.lesson)
        .filter((ls) => ls)
        .reduce((prev, c) => [...prev!, ...c!], [])!) {
        insertLessonIgnore.run([ls.name, ls.description])
        insertLessonDeckIgnore.run([ls.deck, ls.name])
      }

      const insertCard = (ignoreErrors?: boolean) => this.db.prepare(/*sql*/`
      INSERT INTO [card] ([user_id], [key], [data], markdown)
      VALUES (?, ?, ?, ?)
      ${ignoreErrors ? 'ON CONFLICT DO NOTHING' : ''}
      `)

      const insertCardOverwrite = this.db.prepare(/*sql*/`
      INSERT OR REPLACE INTO [card] ([user_id], [key], [data], markdown)
      VALUES (?, ?, ?, ?)
      `)

      for (const el of entries) {
        let cardId: any = null

        if (el.overwrite) {
          cardId = insertCardOverwrite
            .run([userId, el.key, JSON.stringify(el.data || {}), el.markdown || null]).lastInsertRowid
        } else {
          cardId = insertCard(el.ignoreErrors)
            .run([userId, el.key, JSON.stringify(el.data || {}), el.markdown || null]).lastInsertRowid
        }

        if (!cardId) {
          cardId = (getCardId.get([userId, el.key]) || {}).id
        }

        cardIds.push(cardId)
      }

      const insertCardTag = this.db.prepare(/*sql*/`
      INSERT INTO card_tag (card_id, tag_id)
      VALUES (?, (
        SELECT id FROM tag WHERE [name] = ?
      ))
      `)
      const insertCardRef = this.db.prepare(/*sql*/`
      INSERT INTO card_ref (card_id, child_id)
      VALUES (?, (
        SELECT id FROM [card] WHERE [key] = ?
      ))
      `)
      const insertCardDeck = this.db.prepare(/*sql*/`
      INSERT INTO card_deck (card_id, deck_id)
      VALUES (?, (
        SELECT id FROM [deck] WHERE [name] = ? AND lesson_id IS NULL
      ))
      `)
      const insertCardLesson = this.db.prepare(/*sql*/`
      INSERT INTO card_deck (card_id, deck_id)
      VALUES (?, (
        SELECT id FROM [deck] WHERE [name] = ? AND lesson_id = (
          SELECT id FROM lesson WHERE [name] = ?
        )
      ))
      `)
      const insertQuiz = this.db.prepare(/*sql*/`
      INSERT INTO quiz (card_id, stat, srs_level, next_review)
      VALUES (?, ?, ?, ?)
      `)
      const insertMedia = this.db.prepare(/*sql*/`
      INSERT INTO card_media (card_id, media_id)
      VALUES (?, (
        SELECT id FROM media WHERE [name] = ?
      ))
      `)

      for (const el of entries) {
        const cardId = (getCardId.get([userId, el.key]) || {}).id

        if (el.tag) {
          el.tag.map((t) => {
            insertCardTag.run([cardId, t])
          })
        }

        if (el.ref) {
          el.ref.map((ref) => {
            insertCardRef.run([cardId, ref])
          })
        }

        if (el.deck) {
          insertCardDeck.run([cardId, el.deck])
        }

        if (el.lesson) {
          el.lesson.map((ls) => {
            insertCardLesson.run([cardId, ls.deck, ls.name])
          })
        }

        if (el.media) {
          el.media.map((m) => {
            try {
              insertMedia.run([cardId, m])
            } catch (e) {
              console.error(e)
            }
          })
        }

        if (el.nextReview && el.srsLevel) {
          insertQuiz.run([cardId, JSON.stringify(el.stat || {}), el.srsLevel, el.nextReview])
        }
      }
    })()

    this.db.pragma('foreign_keys = on;')
    return cardIds
  }

  import (src: Db, cb: (msg: string) => void) {
    if (cb) {
      cb('inserting media')
    }

    (() => {
      const insert = this.db.prepare(/*sql*/`
      INSERT INTO media ([name], mimetype, [data], meta)
      VALUES (@name, @mimetype, @data, @meta)
      `)

      this.db.transaction(() => {
        for (const m of src.db.prepare(/*sql*/`
        SELECT [name], mimetype, [data], meta
        FROM media
        `).iterate()) {
          try {
            insert.run(m)
          } catch (e) {
            console.error(e)
          }
        }
      })()
    })()

    if (cb) {
      cb('inserting cards')
    }

    this.insert(...src.find(''))
    src.close()
  }

  importAnki2 (filename: string, cb: (msg: string, percent?: number) => void, meta: {
    filename?: string
  } = {}) {
    const src = sqlite3(filename)

    if (cb) {
      cb('creating additional tables')
    }

    src.exec(/*sql*/`
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

    const { decks, models } = src.prepare(/*sql*/`
    SELECT decks, models FROM col
    `).get()

    src.transaction(() => {
      const insertDeck = src.prepare(/*sql*/`
      INSERT INTO decks (id, [name]) VALUES (?, ?) 
      `)

      for (const d of Object.values<any>(JSON.parse(decks))) {
        insertDeck.run([parseInt(d.id), d.name])
      }
    })()

    src.transaction(() => {
      const insertModel = src.prepare(/*sql*/`
      INSERT INTO models (id, [name], flds, css)
      VALUES (?, ?, ?, ?)
      `)
      const insertTemplate = src.prepare(/*sql*/`
      INSERT INTO templates (mid, ord, [name], qfmt, afmt)
      VALUES (?, ?, ?, ?, ?)
      `)

      for (const m of Object.values<any>(JSON.parse(models))) {
        insertModel.run([parseInt(m.id), m.name, m.flds.map((f: any) => f.name).join('\x1f'), m.css])

        m.tmpls.map((t: any, i: number) => {
          insertTemplate.run([parseInt(m.id), i, t.name, t.qfmt, t.afmt])
        })
      }
    })()

    if (cb) {
      cb('inserting cards')
    }

    const normalizeMustache = (s: string, keyData: string) => s.replace(
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

    const allCards = src.prepare(/*sql*/`
    SELECT
      d.name  deck,
      n.flds  [values],
      m.flds  keys,
      m.css   css,
      t.qfmt  qfmt,
      t.afmt  afmt,
      t.name  template,
      m.name  model
    FROM cards c
    JOIN notes n ON c.nid = n.id
    JOIN decks d ON c.did = d.id
    JOIN models m ON n.mid = m.id
    JOIN templates t ON t.ord = c.ord AND t.mid = n.mid
    `).all()

    for (const [i, cs] of chunks(allCards, 1000).entries()) {
      if (cb) {
        cb(`inserting cards: ${i * 1000} of ${allCards.length}`, i * 1000 / allCards.length)
      }

      this.insert(...cs.map((el) => {
        const ks: string[] = el.keys.split('\x1f').map((k: string) => slugify(k))
        const vs: string[] = el.values.split('\x1f')
        const data: any = {}
        ks.map((k, i) => { data[k] = vs[i] })

        const keyData = 'data_' + ser.hash(data)

        const css = el.css.trim() + '\n'
        const keyCss = css ? 'css_' + ser.hash({ css }) : ''

        const qfmt = normalizeMustache(el.qfmt, keyData)
        const afmt = normalizeMustache(el.afmt, keyData)

        const deck = el.deck.replace(/::/g, '/')

        const name = (meta.filename || filename).replace(/\..+?$/, '')

        return [
          {
            ignoreErrors: true,
            key: keyData,
            data
          },
          ...(keyCss ? [
            {
              ignoreErrors: true,
              key: keyCss,
              markdown: '```css parsed\n' + css + '\n```'
            }
          ] : []),
          {
            key: `anki_${name}_${el.model}_${el.template}_${keyData}`,
            ...(meta.filename ? {
              lesson: [
                {
                  name,
                  description: meta.filename,
                  deck
                }
              ]
            } : {
              deck
            }),
            ref: [
              keyData,
              ...(keyCss ? [
                keyCss
              ] : [])
            ],
            markdown: qfmt + '\n\n===\n\n' + afmt + (keyCss ? ('\n\n===\n\n' + `{{{${keyCss}.markdown}}}`) : '')
          }
        ]
      })
        .reduce((prev, c) => [...prev, ...c], [])
        .filter((c: any, i: number, arr: any[]) => arr.map((el) => el.key).indexOf(c.key) === i)
      )
    }

    src.close()
  }

  update (keys: string[], set: IDbSchema) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    const {
      tag,
      srsLevel, nextReview, stat,
      lesson, deck,
      key,
      data,
      ref,
      media,
      markdown
    } = zDbSchema.parse(set)

    let _ids: number[] | null = null
    const getIds = () => {
      if (!_ids) {
        _ids = []

        for (const ks of chunks(keys, 900)) {
          this.db.prepare(/*sql*/`
          SELECT id FROM [card]
          WHERE [key] IN (${Array(ks.length).fill('?').join(',')}) AND [user_id] = ?
          `).all([...ks, userId]).map((c) => {
            if (_ids) {
              _ids.push(c.id)
            }
          })
        }
      }

      return _ids
    }

    this.db.transaction(() => {
      if (key) {
        if (keys.length !== 1) {
          throw new Error('Cannot set multiple cards to have the same key')
        }

        this.db.prepare(/*sql*/`
        UPDATE [card]
        SET [key] = ?
        WHERE [key] = ? AND [user_id] = ?
        `).run([key, keys[0], userId])
      }

      if (data) {
        const getK = this.db.prepare(/*sql*/`
        SELECT [data] FROM [card] WHERE [key] = ? AND [user_id] = ?
        `)
        const update = this.db.prepare(/*sql*/`
        UPDATE [card]
        SET [data] = ?
        WHERE [key] = ? AND [user_id] = ?
        `)

        for (const k of keys) {
          const r = getK.get([k, userId])

          if (r) {
            try {
              const oldData = JSON.parse(r.data)
              update.run([JSON.stringify(deepMerge(oldData, data)), k, userId])
            } catch (_) {}
          }
        }
      }

      if (typeof markdown !== 'undefined') {
        const update = this.db.prepare(/*sql*/`
        UPDATE [card]
        SET markdown = ?
        WHERE [key] = ? AND [user_id] = ?
        `)

        for (const k of keys) {
          update.run([markdown, k, userId])
        }
      }

      if (ref) {
        const deleteOld = this.db.prepare(/*sql*/`
        DELETE FROM card_ref
        WHERE card_id = ?
        `)
        const insert = this.db.prepare(/*sql*/`
        INSERT INTO card_ref (card_id, child_id) VALUES (?, (
          SELECT id FROM [card] WHERE [key] = ?
        ))
        ON CONFLICT DO NOTHING
        `)

        for (const id of getIds()) {
          deleteOld.run(id)

          for (const r of ref) {
            insert.run([id, r])
          }
        }
      }

      if (media) {
        const clearMedia = this.db.prepare(/*sql*/`
        DELETE FROM card_media
        WHERE card_id = ?
        `)

        const insertMedia = this.db.prepare(/*sql*/`
        INSERT INTO card_media (card_id, media_id)
        VALUES (?, (
          SELECT id FROM media WHERE [name] = ?
        ))
        ON CONFLICT DO NOTHING
        `)

        for (const id of getIds()) {
          clearMedia.run([id])

          media.map((m) => {
            try {
              insertMedia.run([id, m])
            } catch (e) {
              console.error(e)
            }
          })
        }
      }

      if (typeof srsLevel === 'number') {
        for (const ids of chunks(getIds(), 900)) {
          this.db.prepare(/*sql*/`
          UPDATE quiz
          SET srs_level = ?
          WHERE card_id IN (${Array(ids.length).fill('?').join(',')})
          `).run(srsLevel, ...ids)
        }
      }

      if (nextReview) {
        for (const ids of chunks(getIds(), 900)) {
          this.db.prepare(/*sql*/`
          UPDATE quiz
          SET next_review = ?
          WHERE card_id IN (${Array(ids.length).fill('?').join(',')})
          `).run(+dayjs(nextReview).toDate(), ...ids)
        }
      }

      if (stat) {
        const getOld = this.db.prepare(/*sql*/`
        SELECT stat FROM quiz WHERE card_id = ?
        `)
        const update = this.db.prepare(/*sql*/`
        UPDATE quiz
        SET stat = ?
        WHERE card_id = ?
        `)

        for (const id of getIds()) {
          const r = getOld.get(id)

          if (r) {
            try {
              const oldStat = JSON.parse(r.stat)
              update.run(JSON.stringify(deepMerge(oldStat, stat)), id)
            } catch (_) {}
          }
        }
      }

      if (deck) {
        this.db.prepare(/*sql*/`
        INSERT INTO deck ([name]) VALUES (?)
        ON CONFLICT DO NOTHING
        `).run(deck)

        const deleteOld = this.db.prepare(/*sql*/`
        DELETE FROM card_deck
        WHERE card_id = ? AND deck_id = (
          SELECT id FROM deck WHERE lesson_id IS NULL
        )
        `)

        const insert = this.db.prepare(/*sql*/`
        INSERT INTO card_deck (card_id, deck_id) VALUES (?, (
          SELECT id FROM deck WHERE [name] = ? AND lesson_id IS NULL
        ))
        ON CONFLICT DO NOTHING
        `)

        for (const id of getIds()) {
          deleteOld.run(id)
          insert.run(id, deck)
        }
      }

      if (lesson) {
        const insertLesson = this.db.prepare(/*sql*/`
        INSERT INTO lesson ([name], [description]) VALUES (?, ?)
        ON CONFLICT DO NOTHING
        `)
        const insertDeck = this.db.prepare(/*sql*/`
        INSERT INTO deck ([name], lesson_id) VALUES (?, (
          SELECT id FROM lesson WHERE [name] = ?
        ))
        ON CONFLICT DO NOTHING
        `)
        const deleteOld = this.db.prepare(/*sql*/`
        DELETE FROM card_deck
        WHERE card_id = ? AND deck_id = (
          SELECT id FROM deck WHERE lesson_id = (
            SELECT id FROM lesson WHERE [name] = ?
          )
        )
        `)
        const insertNew = this.db.prepare(/*sql*/`
        INSERT INTO card_deck (card_id, deck_id) VALUES (?, (
          SELECT id FROM deck WHERE [name] = ? AND lesson_id = (
            SELECT id FROM lesson WHERE [name] = ?
          )
        ))
        ON CONFLICT DO NOTHING
        `)

        for (const ls of lesson) {
          insertLesson.run(ls.name, ls.description)
          insertDeck.run(ls.deck, ls.name)

          for (const id of getIds()) {
            deleteOld.run(id, ls.name)
            insertNew.run(id, deck, ls.name)
          }
        }
      }

      if (tag) {
        const create = this.db.prepare(/*sql*/`
        INSERT INTO tag ([name]) VALUES (?)
        ON CONFLICT DO NOTHING
        `)
        const deleteOld = this.db.prepare(/*sql*/`
        DELETE FROM card_tag WHERE card_id = ?
        `)
        const insertNew = this.db.prepare(/*sql*/`
        INSERT INTO card_tag (card_id, tag_id) VALUES (?, (
          SELECT id FROM tag WHERE [name] = ?
        ))
        `)

        for (const t of tag) {
          create.run(t)

          for (const id of getIds()) {
            deleteOld.run(id)
            insertNew.run(id, t)
          }
        }
      }
    })()
  }

  delete (...keys: string[]) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    for (const ks of chunks(keys, 900)) {
      this.db.prepare(/*sql*/`
      DELETE FROM [card]
      WHERE [key] IN (${Array(ks.length).fill('?').join(',')}) AND [user_id] = ?
      `).run([...ks, userId])
    }
  }

  addTags (keys: string[], tags: string[]) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    this.db.transaction(() => {
      this.db.pragma('read_uncommitted = on;')

      const create = this.db.prepare(/*sql*/`
      INSERT INTO tag ([name]) VALUES (?)
      ON CONFLICT DO NOTHING
      `)
      const link = this.db.prepare(/*sql*/`
      INSERT INTO card_tag (card_id, tag_id) VALUES (
        (SELECT id FROM [card] WHERE [key] = ? AND [user_id] = ?),
        (SELECT id FROM tag WHERE [name] = ?)
      )
      ON CONFLICT DO NOTHING
      `)

      for (const t of tags) {
        create.run([t])

        for (const k of keys) {
          link.run([k, userId, t])
        }
      }

      this.db.pragma('read_uncommitted = off;')
    })
  }

  removeTags (keys: string[], tags: string[]) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    this.db.transaction(() => {
      for (const ks of chunks(keys, 900)) {
        this.db.prepare(/*sql*/`
        DELETE FROM card_tag WHERE (
          card_id = (SELECT id FROM [card] WHERE [key] IN ${Array(ks.length).fill('?').join(',')} AND [user_id] = ?) AND
          tag_id = (SELECT id FROM tag WHERE [name] IN ${Array(tags.length).fill('?').join(',')})
        )
        `).run([...ks, userId, ...tags])
      }
    })
  }

  renderMin (key: string) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    const r = this.db.prepare(/*sql*/`
    SELECT id, [key], [data], markdown
    FROM [card]
    WHERE [user_id] = ? AND [key] = ?
    `).get([userId, key]) || {}

    if (r.id) {
      r.ref = this.db.prepare(/*sql*/`
      SELECT c.key ref
      FROM card_ref cr
      JOIN [card] c ON cr.child_id = c.id
      WHERE card_id = ?
      `).all([r.id]).map((r0) => r0.ref)
    }

    return r
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  private _updateSrsLevel (dSrsLevel: number) {
    return (key: string) => {
      const userId = this.signInOrCreate()
      if (!userId) {
        throw new Error('Not logged in')
      }

      const card = this.db.prepare(/*sql*/`
      SELECT id FROM [card] WHERE [user_id] = ? AND [key] = ?
      `).get([userId, key])

      if (!card) {
        throw new Error(`Card ${key} not found.`)
      }

      const quiz = this.db.prepare(/*sql*/`
      SELECT id, stat, srs_level FROM quiz
      WHERE card_id = ?
      `).get([card.id])

      let srsLevel = 0
      let stat = {}
      let nextReview = repeatReview()

      if (quiz) {
        srsLevel = quiz.srsLevel
        stat = JSON.parse(quiz.stat)
      }

      if (dSrsLevel > 0) {
        dotProp.set(stat, 'streak.right', dotProp.get(stat, 'streak.right', 0) + 1)
        dotProp.set(stat, 'streak.wrong', 0)
        dotProp.set(stat, 'lastRight', new Date())

        if (dotProp.get(stat, 'streak.right', 1) > dotProp.get(stat, 'streak.maxRight', 0)) {
          dotProp.set(stat, 'streak.maxRight', dotProp.get(stat, 'streak.right', 1))
        }
      } else if (dSrsLevel < 0) {
        dotProp.set(stat, 'streak.wrong', dotProp.get(stat, 'streak.wrong', 0) + 1)
        dotProp.set(stat, 'streak.right', 0)
        dotProp.set(stat, 'lastWrong', new Date())

        if (dotProp.get(stat, 'streak.wrong', 1) > dotProp.get(stat, 'streak.maxWrong', 0)) {
          dotProp.set(stat, 'streak.maxWrong', dotProp.get(stat, 'streak.wrong', 1))
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
        nextReview = getNextReview(srsLevel)
      }

      if (!quiz) {
        this.db.prepare(/*sql*/`
        INSERT INTO quiz (srs_level, stat, next_review, card_id)
        VALUES (?, ?, ?, ?)
        `).run([srsLevel, JSON.stringify(stat), +nextReview, card.id])
      } else {
        this.db.prepare(/*sql*/`
        UPDATE quiz
        SET srs_level = ?, stat = ?, next_review = ?
        WHERE id = ?
        `).run([srsLevel, JSON.stringify(stat), +nextReview, quiz.id])
      }
    }
  }

  insertMedia (file: UploadedFile, key?: string) {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    const existingFilenames = this.db.prepare(/*sql*/`
    SELECT [name]
    FROM media m
    JOIN card_media cm ON m.id = cm.media_id
    JOIN [card] c ON c.id = cm.card_id
    WHERE [user_id] = ?
    `).all([userId]).map((m) => m.name)

    let filename = file.name
    if (filename === 'image.png') {
      filename = dayjs().format('YYYYMMDD-HHmm') + '.png'
    }

    const [, base, ext] = /^.+(\..+)?/.exec(file.name) || ['', filename, '']

    while (existingFilenames.includes(filename)) {
      filename = base + '-' + Math.random().toString(36).substr(2, 4) + ext
    }

    this.db.prepare(/*sql*/`
    INSERT INTO media ([name], mimetype, [data])
    VALUES (?, ?)
    `).run([filename, file.mimetype, file.data.buffer])

    if (key) {
      this.db.prepare(/*sql*/`
      INSERT INTO card_media (card_id, media_id)
      VALUES (
        (SELECT id FROM [card] WHERE [key] = ?),
        (SELECT id FROM media WHERE [name] = ?)
      )
      `).run(key, filename)
    }

    return filename
  }

  getMedia (name: string): {
    mimetype?: string
    data?: Buffer
  } {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    return this.db.prepare(/*sql*/`
    SELECT mimetype, [data] FROM media
    WHERE [name] = ?
    `).get([name]) || {}
  }

  allLessons () {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    return this.db.prepare(/*sql*/`
    SELECT DISTINCT ls.name [name], ls.description [description]
    FROM lesson ls
    JOIN deck d ON ls.id = d.lesson_id
    JOIN card_deck cd ON cd.deck_id = d.id
    JOIN [card] c ON c.id = cd.card_id
    WHERE c.user_id = ?
    ORDER BY ls.created_at DESC
    `).all([userId])
  }

  allDecks (): string[] {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    return this.db.prepare(/*sql*/`
    SELECT DISTINCT d.name deck
    FROM deck d
    JOIN card_deck cd ON cd.deck_id = d.id
    JOIN [card] c ON c.id = cd.card_id
    WHERE c.user_id = ?
    ORDER BY deck ASC
    `).all([userId]).map((r) => r.deck)
  }

  allTags (): string[] {
    const userId = this.signInOrCreate()
    if (!userId) {
      throw new Error('Not logged in')
    }

    return this.db.prepare(/*sql*/`
    SELECT DISTINCT t.name tag
    FROM tag t
    JOIN card_tag ct ON ct.tag_id = t.id
    JOIN [card] c ON c.id = ct.card_id
    WHERE c.user_id = ?
    ORDER BY tag ASC
    `).all([userId]).map((r) => r.tag)
  }
}
