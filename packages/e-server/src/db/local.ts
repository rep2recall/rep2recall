import crypto from 'crypto'

import sql from 'sqlite'
import sql3 from 'sqlite3'
import * as z from 'zod'
import dayjs from 'dayjs'
import QSearch from '@patarapolw/qsearch'

import { removeNull } from './util'

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
  db!: sql.Database

  constructor (public filename: string) {}

  async init () {
    this.db = await sql.open({
      filename: this.filename,
      driver: sql3.Database
    })

    await this.db.exec(/*sql*/`
    CREATE TABLE IF NOT EXISTS user (
      id        INTEGER PRIMARY KEY,
      email     TEXT UNIQUE,
      [secret]  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS [card] (
      id            INTEGER PRIMARY KEY,
      [user_id]     INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      [key]         TEXT NOT NULL UNIQUE,
      [data]        TEXT NOT NULL DEFAULT '{}', -- json
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
      stat        TEXT NOT NULL DEFAULT '{}' -- json
    );
    `)
  }

  generateSecret () {
    return crypto.randomBytes(64).toString('base64')
  }

  async signInOrCreate (email?: string): Promise<number> {
    let u: any = null
    if (email) {
      u = await this.db.get(/*sql*/`
      SELECT id FROM user WHERE email = ?
      `, email)
    } else {
      u = await this.db.get(/*sql*/`
      SELECT id FROM user WHERE email IS NULL
      `)
    }

    if (u) {
      return u.id
    }

    const r = await this.db.run(/*sql*/`
    INSERT INTO user (email, [secret])
    VALUES (?, ?)
    `, email, this.generateSecret())

    return r.lastID!
  }

  async signInWithSecret (email: string, secret: string): Promise<number | null> {
    let u: any = null
    if (email) {
      u = await this.db.get(/*sql*/`
      SELECT id FROM user WHERE email = ? AND [secret] = ?
      `, email, secret)
    } else {
      u = await this.db.get(/*sql*/`
      SELECT id FROM user WHERE email IS NULL AND [secret] = ?
      `, secret)
    }

    return u ? u.id : null
  }

  async close () {
    await this.db.close()
  }

  async find (userId: number, q: string | Record<string, any>, cb?: (r: IDbSchema) => void) {
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

    await this.db.each(/*sql*/`
    SELECT id, [key], [data], markdown FROM [card]
    WHERE [user_id] = ?
    `, userId, async (err: Error, r: any) => {
      if (err) {
        console.error(err)
        return
      }

      r.lesson = await this.db.all(/*sql*/`
      SELECT ls.name [name], ls.description [description], d.name deck
      FROM deck d
      LEFT JOIN lesson ls ON d.lesson_id = ls.id
      JOIN card_deck cd ON cd.deck_id = d.id
      WHERE cd.card_id = ?
      `, r.id)
      r.deck = r.lesson.filter((ls: any) => !ls.name).map((ls: any) => ls.deck)[0]
      r.lesson = r.lesson.filter((ls: any) => ls.name)

      r.tag = (await this.db.all(/*sql*/`
      SELECT t.name [name]
      FROM tag t
      JOIN card_tag ct ON ct.tag_id = t.id
      WHERE ct.card_id = ?
      `, r.id)).map((t) => t.name)

      r.ref = (await this.db.all(/*sql*/`
      SELECT child_id
      FROM card_ref
      WHERE card_id = ?
      `, r.id)).map((cr) => cr.child_id)

      Object.assign(r, await this.db.get(/*sql*/`
      SELECT srs_level srsLevel, next_review nextReview, stat
      FROM quiz
      WHERE card_id = ?
      `, r.id))

      r.stat = JSON.parse(r.stat)
      r.data = JSON.parse(r.data)

      if (!filterFunction(r)) {
        return
      }

      if (cb) {
        cb(r)
      }

      result.push(r)
    })

    return result
  }

  async insert (userId: number, ...entries: IDbSchema[]) {
    entries = entries.map((el) => {
      return zDbSchema.parse(removeNull(el))
    })

    const nativeDb = this.db.db
    const nativeGet = async (sql: string, ...params: any[]) => {
      return new Promise<any>((resolve, reject) => {
        nativeDb.get(sql, ...params, (err: Error, r: any) => err ? reject(err) : resolve(r))
      })
    }

    const cardIds: number[] = []

    return new Promise<number[]>((resolve) => {
      nativeDb.serialize(async () => {
        nativeDb.run('BEGIN TRANSACTION')
        nativeDb.run('PRAGMA foreign_keys = off')
        nativeDb.run('PRAGMA read_uncommitted = on')

        for (const t of entries
          .map((el) => el.tag)
          .filter((ts) => ts)
          .reduce((prev, c) => [...prev!, ...c!], [])!
          .filter((c, i, arr) => arr.indexOf(c) === i)) {
          nativeDb.run(/*sql*/`
          INSERT INTO tag ([name]) VALUES (?)
          ON CONFLICT DO NOTHING
          `, t)
        }

        for (const d of entries
          .map((el) => el.deck)
          .filter((d) => d)
          .filter((c, i, arr) => arr.indexOf(c) === i)) {
          nativeDb.run(/*sql*/`
          INSERT INTO deck ([name]) VALUES (?)
          ON CONFLICT DO NOTHING
          `, d)
        }

        for (const ls of entries
          .map((el) => el.lesson)
          .filter((ls) => ls)
          .reduce((prev, c) => [...prev!, ...c!], [])!
          .filter((c, i, arr) => arr.map((ls) => ls.name).indexOf(c.name) === i)) {
          nativeDb.run(/*sql*/`
          INSERT INTO lesson ([name], [description]) VALUES (?, ?)
          ON CONFLICT DO NOTHING
          `, ls.name, ls.description)

          nativeDb.run(/*sql*/`
          INSERT INTO deck ([name], lesson_id) VALUES (?, (
            SELECT id FROM lesson WHERE [name] = ?
          ))
          ON CONFLICT DO NOTHING
          `, ls.deck, ls.name)
        }

        for (const el of entries) {
          let cardId: any = null

          if (el.overwrite && el.key) {
            cardId = await new Promise<number>((resolve, reject) => {
              nativeDb.run(/*sql*/`
              INSERT OR REPLACE INTO [card] ([user_id], [key], [data], markdown)
              VALUES (?, ?, ?, ?, ?)
              `, userId, el.key, JSON.stringify(el.data || {}), el.markdown, (err: Error, r: any) => {
                err ? reject(err) : resolve(r.lastID)
              })
            })
          } else {
            cardId = await new Promise<number>((resolve, reject) => {
              nativeDb.run(/*sql*/`
              INSERT INTO [card] ([user_id], [key], [data], markdown)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT DO NOTHING
              `, userId, el.key, JSON.stringify(el.data || {}), el.markdown, (err: Error, r: any) => {
                err ? reject(err) : resolve(r.lastID)
              })
            })

            if (!cardId) {
              (el as any).cardId = (await nativeGet(/*sql*/`
              SELECT id FROM [card]
              WHERE [user_id] = ? AND [key] = ?
              `, userId, el.key) || {}).id
            }
          }

          cardIds.push(cardId)

          if (el.tag) {
            el.tag.map((t) => {
              nativeDb.run(/*sql*/`
              INSERT INTO card_tag (card_id, tag_id)
              VALUES (?, (
                SELECT id FROM tag WHERE [name] = ?
              ))
              ON CONFLICT DO NOTHING
              `, cardId, t)
            })
          }

          if (el.ref) {
            el.ref.map((ref) => {
              nativeDb.run(/*sql*/`
              INSERT INTO card_ref (card_id, child_id)
              VALUES (?, (
                SELECT id FROM [card] WHERE [key] = ?
              ))
              ON CONFLICT DO NOTHING
              `, cardId, ref)
            })
          }

          if (el.deck) {
            nativeDb.run(/*sql*/`
            INSERT INTO card_deck (card_id, deck_id)
            VALUES (?, (
              SELECT id FROM [deck] WHERE [name] = ? AND lesson_id IS NULL
            ))
            ON CONFLICT DO NOTHING
            `, cardId, el.deck)
          }

          if (el.lesson) {
            el.lesson.map((ls) => {
              nativeDb.run(/*sql*/`
              INSERT INTO card_deck (card_id, deck_id)
              VALUES (?, (
                SELECT id FROM [deck] WHERE [name] = ? AND lesson_id = (
                  SELECT id FROM lesson WHERE [name] = ?
                )
              ))
              ON CONFLICT DO NOTHING
              `, cardId, el.deck, ls.name)
            })
          }

          if (el.nextReview && el.srsLevel) {
            nativeDb.run(/*sql*/`
            INSERT INTO quiz (card_id, stat, srs_level, next_review)
            VALUES (?, ?, ?, ?)
            ON CONFLICT DO NOTHING
            `, cardId, JSON.stringify(el.stat || {}), el.srsLevel, el.nextReview)
          }
        }

        nativeDb.run('PRAGMA foreign_keys = on')
        nativeDb.run('COMMIT', () => {
          nativeDb.run('PRAGMA read_uncommitted = off')
          resolve(cardIds)
        })
      })
    })
  }
}
