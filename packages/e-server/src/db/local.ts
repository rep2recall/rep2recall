import crypto from 'crypto'

import sqlite3 from 'better-sqlite3'
import * as z from 'zod'
import dayjs from 'dayjs'
import QSearch from '@patarapolw/qsearch'

import { removeNull, chunks, deepMerge } from './util'

const zDateType = z.string().refine((d) => {
  return typeof d === 'string' && isNaN(d as any) && dayjs(d).isValid()
}, 'not a Date').nullable().optional()
const zPosInt = z.number().refine((i) => Number.isInteger(i) && i > 0, 'not positive integer')

export const zDbSchema = z.object({
  overwrite: z.boolean().optional(),
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
  markdown: z.string().optional(),
  nextReview: zDateType.optional(),
  srsLevel: zPosInt.nullable().optional(),
  stat: z.object({
    streak: z.object({
      right: zPosInt.optional(),
      wrong: zPosInt.optional(),
      maxRight: zPosInt.optional(),
      maxWrong: zPosInt.optional()
    }),
    lastRight: zDateType.optional(),
    lastWrong: zDateType.optional()
  }).optional()
})

export type IDbSchema = z.infer<typeof zDbSchema>

export class Db {
  db!: sqlite3.Database

  constructor (public filename: string) {
    this.db = sqlite3(filename)

    this.db.exec(/*sql*/`
    CREATE TABLE IF NOT EXISTS user (
      id        INTEGER PRIMARY KEY,
      email     TEXT UNIQUE,
      [secret]  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS [card] (
      id            INTEGER PRIMARY KEY,
      [user_id]     INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      [key]         TEXT NOT NULL UNIQUE,
      [data]        TEXT DEFAULT '{}', -- json
      markdown      TEXT
      -- relation m2m tag
      -- relation m2m ref
      -- relation m2m lesson
      -- relation o2m quiz
    );

    CREATE TABLE IF NOT EXISTS tag (
      id      INTEGER PRIMARY KEY,
      [name]  TEXT NOT NULL UNIQUE
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
      [description] TEXT
    );

    CREATE TABLE IF NOT EXISTS deck (
      id        INTEGER PRIMARY KEY,
      [name]    TEXT NOT NULL,
      lesson_id INTEGER REFERENCES lesson(id) ON DELETE CASCADE,
      UNIQUE ([name], lesson_id)
    );

    CREATE TABLE IF NOT EXISTS card_deck (
      card_id   INTEGER NOT NULL REFERENCES [card](id) ON DELETE CASCADE,
      deck_id   INTEGER NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
      UNIQUE (card_id, deck_id)
    );

    CREATE TABLE IF NOT EXISTS quiz (
      card_id     INTEGER NOT NULL UNIQUE REFERENCES [card](id) ON DELETE CASCADE,
      next_review INTEGER NOT NULL, -- epoch seconds
      srs_level   INTEGER NOT NULL,
      stat        TEXT DEFAULT '{}' -- json
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
      `).get(email)
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
    `).run(email, this.generateSecret())

    return r.lastInsertRowid.valueOf() as number
  }

  signInWithSecret (email: string, secret: string): number | null {
    let u: any = null
    if (email) {
      u = this.db.prepare(/*sql*/`
      SELECT id FROM user WHERE email = ? AND [secret] = ?
      `).get(email, secret)
    } else {
      u = this.db.prepare(/*sql*/`
      SELECT id FROM user WHERE email IS NULL AND [secret] = ?
      `).get(secret)
    }

    return u ? u.id : null
  }

  close () {
    return this.db.close()
  }

  find (userId: number, q: string | Record<string, any>, cb?: (r: IDbSchema) => void) {
    const qSearch = new QSearch({
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

    if (typeof q === 'string') {
      q = qSearch.parse(q).cond as Record<string, any>
    }

    const result: IDbSchema[] = []
    const filterFunction = qSearch.filterFunction(q)

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
      SELECT child_id
      FROM card_ref
      WHERE card_id = ?
      `),
      getQuiz: this.db.prepare(/*sql*/`
      SELECT srs_level srsLevel, next_review nextReview, stat
      FROM quiz
      WHERE card_id = ?
      `)
    }

    for (const r of this.db.prepare(/*sql*/`
    SELECT id, [key], [data], markdown FROM [card]
    WHERE [user_id] = ?
    `).iterate(userId)) {
      r.lesson = stmt.getLesson.all(r.id)

      r.deck = r.lesson.filter((ls: any) => !ls.name).map((ls: any) => ls.deck)[0]
      r.lesson = r.lesson.filter((ls: any) => ls.name)

      r.tag = stmt.getTag.all(r.id).map((t) => t.name)
      r.ref = stmt.getRef.all(r.id).map((cr) => cr.child_id)

      Object.assign(r, stmt.getQuiz.all(r.id))

      r.stat = JSON.parse(r.stat)
      r.data = JSON.parse(r.data)

      if (!filterFunction(r)) {
        return
      }

      if (cb) {
        cb(r)
      }

      result.push(r)
    }

    return result
  }

  insert (userId: number, ...entries: IDbSchema[]) {
    entries = entries.map((el) => {
      return zDbSchema.parse(removeNull(el))
    })

    const cardIds: number[] = []

    this.db.transaction(() => {
      this.db.pragma('foreign_keys = off;')
      this.db.pragma('read_uncommitted = on;')

      const insertTag = this.db.prepare(/*sql*/`
      INSERT INTO tag ([name]) VALUES (?)
      ON CONFLICT DO NOTHING
      `)

      for (const t of entries
        .map((el) => el.tag)
        .filter((ts) => ts)
        .reduce((prev, c) => [...prev!, ...c!], [])!
        .filter((c, i, arr) => arr.indexOf(c) === i)) {
        insertTag.run(t)
      }

      const insertDeck = this.db.prepare(/*sql*/`
      INSERT INTO deck ([name]) VALUES (?)
      ON CONFLICT DO NOTHING
      `)

      for (const d of entries
        .map((el) => el.deck)
        .filter((d) => d)
        .filter((c, i, arr) => arr.indexOf(c) === i)) {
        insertDeck.run(d)
      }

      const insertLesson = this.db.prepare(/*sql*/`
      INSERT INTO lesson ([name], [description]) VALUES (?, ?)
      ON CONFLICT DO NOTHING
      `)
      const insertLessonDeck = this.db.prepare(/*sql*/`
      INSERT INTO deck ([name], lesson_id) VALUES (?, (
        SELECT id FROM lesson WHERE [name] = ?
      ))
      ON CONFLICT DO NOTHING
      `)

      for (const ls of entries
        .map((el) => el.lesson)
        .filter((ls) => ls)
        .reduce((prev, c) => [...prev!, ...c!], [])!
        .filter((c, i, arr) => arr.map((ls) => ls.name).indexOf(c.name) === i)) {
        insertLesson.run(ls.name, ls.description)
        insertLessonDeck.run(ls.deck, ls.name)
      }

      const insertCardOverwrite = this.db.prepare(/*sql*/`
      INSERT OR REPLACE INTO [card] ([user_id], [key], [data], markdown)
      VALUES (?, ?, ?, ?, ?)
      `)
      const insertCardIgnore = this.db.prepare(/*sql*/`
      INSERT INTO [card] ([user_id], [key], [data], markdown)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
      `)
      const getCardId = this.db.prepare(/*sql*/`
      SELECT id FROM [card]
      WHERE [user_id] = ? AND [key] = ?
      `)
      const insertCardTag = this.db.prepare(/*sql*/`
      INSERT INTO card_tag (card_id, tag_id)
      VALUES (?, (
        SELECT id FROM tag WHERE [name] = ?
      ))
      ON CONFLICT DO NOTHING
      `)
      const insertCardRef = this.db.prepare(/*sql*/`
      INSERT INTO card_ref (card_id, child_id)
      VALUES (?, (
        SELECT id FROM [card] WHERE [key] = ?
      ))
      ON CONFLICT DO NOTHING
      `)
      const insertCardDeck = this.db.prepare(/*sql*/`
      INSERT INTO card_deck (card_id, deck_id)
      VALUES (?, (
        SELECT id FROM [deck] WHERE [name] = ? AND lesson_id IS NULL
      ))
      ON CONFLICT DO NOTHING
      `)
      const insertCardLesson = this.db.prepare(/*sql*/`
      INSERT INTO card_deck (card_id, deck_id)
      VALUES (?, (
        SELECT id FROM [deck] WHERE [name] = ? AND lesson_id = (
          SELECT id FROM lesson WHERE [name] = ?
        )
      ))
      ON CONFLICT DO NOTHING
      `)
      const insertQuiz = this.db.prepare(/*sql*/`
      INSERT INTO quiz (card_id, stat, srs_level, next_review)
      VALUES (?, ?, ?, ?)
      ON CONFLICT DO NOTHING
      `)

      for (const el of entries) {
        let cardId: any = null

        if (el.overwrite && el.key) {
          cardId = insertCardOverwrite.run(userId, el.key, JSON.stringify(el.data || {}), el.markdown || null)
        } else {
          cardId = insertCardIgnore.run(userId, el.key, JSON.stringify(el.data || {}), el.markdown || null)

          if (!cardId) {
            cardId = (getCardId.get(userId, el.key) || {}).id
          }
        }

        cardIds.push(cardId)

        if (el.tag) {
          el.tag.map((t) => {
            insertCardTag.run(cardId, t)
          })
        }

        if (el.ref) {
          el.ref.map((ref) => {
            insertCardRef.run(cardId, ref)
          })
        }

        if (el.deck) {
          insertCardDeck.run(cardId, el.deck)
        }

        if (el.lesson) {
          el.lesson.map((ls) => {
            insertCardLesson.run(cardId, el.deck, ls.name)
          })
        }

        if (el.nextReview && el.srsLevel) {
          insertQuiz.run(cardId, JSON.stringify(el.stat || {}), el.srsLevel, el.nextReview)
        }
      }

      this.db.pragma('foreign_keys = on;')
      this.db.pragma('read_uncommitted = off;')
    })()

    return cardIds
  }

  // @ts-ignore
  update (userId: number, keys: string[], set: IDbSchema) {
    const {
      tag,
      srsLevel, nextReview, stat,
      lesson, deck,
      key,
      data,
      ref,
      markdown
    } = zDbSchema.parse(set)

    let _ids: number[] | null = null
    const getIds = () => {
      if (!_ids) {
        _ids = []

        for (const ks of chunks(keys, 900)) {
          this.db.prepare(/*sql*/`
          SELECT id FROM [card] WHERE [key] IN (${Array(ks.length).fill('?').join(',')})
          `).all(ks).map((c) => {
            if (_ids) {
              _ids.push(c.id)
            }
          })
        }
      }

      return _ids
    }

    this.db.transaction(() => {
      this.db.pragma('read_uncommitted = on;')

      if (key) {
        if (keys.length !== 1) {
          throw new Error('Cannot set multiple cards to have the same key')
        }

        this.db.prepare(/*sql*/`
        UPDATE [card]
        SET [key] = ?
        WHERE [key] = ?
        `).run(key, keys[0])
      }

      if (data) {
        const getK = this.db.prepare(/*sql*/`
        SELECT [data] FROM [card] WHERE [key] = ?
        `)
        const update = this.db.prepare(/*sql*/`
        UPDATE [card]
        SET [data] = ?
        WHERE [key] = ?
        `)

        for (const k of keys) {
          const r = getK.get(k)

          if (r) {
            try {
              const oldData = JSON.parse(r.data)
              update.run(JSON.stringify(deepMerge(oldData, data)), k)
            } catch (_) {}
          }
        }
      }

      if (typeof markdown !== 'undefined') {
        const update = this.db.prepare(/*sql*/`
        UPDATE [card]
        SET markdown = ?
        WHERE [key] = ?
        `)

        for (const k of keys) {
          update.run(markdown, k)
        }
      }

      if (ref) {
        const deleteOld = this.db.prepare(/*sql*/`
        DELETE FROM card_ref
        WHERE card_id = ?
        `)
        const insert = this.db.prepare(/*sql*/`
        INSERT INTO card_ref (card_id, child_id) VALUES (?, ?)
        ON CONFLICT DO NOTHING
        `)

        for (const id of getIds()) {
          deleteOld.run(id)

          for (const rid of ref) {
            insert.run(id, rid)
          }
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

      this.db.pragma('read_uncommitted = off;')
    })()
  }
}
