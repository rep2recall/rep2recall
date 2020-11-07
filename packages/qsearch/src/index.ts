import { ISplitOpToken, removeBraces, splitOp } from './tokenize'

import { Ulid } from 'id128'
import sqlite from 'better-sqlite3'

export interface ICard {
  deck: string[]
  front: string
  back?: string
  mnemonic?: string
  note?: Record<string, string>
  srsLevel?: number
  nextReview?: Date
  rightStreak?: number
  wrongStreak?: number
  lastRight?: Date
  lastWrong?: Date
  maxRight?: number
  maxWrong?: number
}

export class QSearch {
  db: sqlite.Database

  constructor(public filename: string) {
    this.db = sqlite(filename)
  }

  init() {
    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS [card] (
      [uid]         VARCHAR PRIMARY KEY,
      [deck]        VARCHAR NOT NULL,  -- :: separated
      [front]       VARCHAR NOT NULL,
      -- [tFront]      VARCHAR,
      [back]        VARCHAR,
      -- [tBack]       VARCHAR,
      [mnemonic]    VARCHAR,
      [noteId]      VARCHAR,
      -- [templateId]  VARCHAR REFERENCES [template]([id]),
      [srsLevel]    INT,
      [nextReview]  INT,  -- epoch milliseconds
      [rightStreak] INT,
      [wrongStreak] INT,
      [lastRight]   INT,  -- epoch milliseconds
      [lastWrong]   INT,  -- epoch milliseconds
      [maxRight]    INT,
      [maxWrong]    INT
    );

    CREATE INDEX IF NOT EXISTS card_deck        ON [card]([deck]);
    CREATE INDEX IF NOT EXISTS card_noteId      ON [card]([noteId]);
    -- CREATE INDEX IF NOT EXISTS card_templateId  ON [card]([templateId]);
    CREATE INDEX IF NOT EXISTS card_srsLevel    ON [card]([srsLevel]);
    CREATE INDEX IF NOT EXISTS card_nextReview  ON [card]([nextReview]);
    CREATE INDEX IF NOT EXISTS card_rightStreak ON [card]([rightStreak]);
    CREATE INDEX IF NOT EXISTS card_wrongStreak ON [card]([wrongStreak]);
    CREATE INDEX IF NOT EXISTS card_lastRight   ON [card]([lastRight]);
    CREATE INDEX IF NOT EXISTS card_lastWrong   ON [card]([lastWrong]);
    CREATE INDEX IF NOT EXISTS card_maxRight    ON [card]([maxRight]);
    CREATE INDEX IF NOT EXISTS card_maxWrong    ON [card]([maxWrong]);
    `)

    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS [noteAttr] (
      [uid]         VARCHAR PRIMARY KEY,
      [noteId]      VARCHAR NOT NULL,
      [key]         VARCHAR NOT NULL,
      [value]       VARCHAR NOT NULL
    );

    CREATE INDEX IF NOT EXISTS noteAttr_noteId  ON [noteAttr]([noteId]);
    CREATE INDEX IF NOT EXISTS noteAttr_key     ON [noteAttr]([key]);
    CREATE INDEX IF NOT EXISTS noteAttr_value   ON [noteAttr]([value]);
    `)
  }

  insertMany(cards: ICard[]) {
    const insertCard = this.db.prepare(/* sql */ `
    INSERT INTO [card] (
      [uid],
      [deck],
      [front],
      [back],
      [mnemonic],
      [noteId],
      [srsLevel],
      [nextReview],
      [rightStreak],
      [wrongStreak],
      [lastRight],
      [lastWrong],
      [maxRight],
      [maxWrong]
    ) VALUES (
      @uid,
      @deck,
      @front,
      @back,
      @mnemonic,
      @noteId,
      @srsLevel,
      @nextReview,
      @rightStreak,
      @wrongStreak,
      @lastRight,
      @lastWrong,
      @maxRight,
      @maxWrong
    )
    `)

    const insertNoteAttr = this.db.prepare(/* sql */ `
    INSERT INTO [noteAttr] (
      [uid],
      [noteId],
      [key],
      [value]
    ) VALUES (
      @uid,
      @noteId,
      @key,
      @value
    )
    `)

    this.db.transaction(() => {
      cards.map((c) => {
        const uid = Ulid.generate().toCanonical()
        let noteId: string | null = null

        if (c.note) {
          noteId = Ulid.generate().toCanonical()
          Object.entries(c.note).map(([key, value]) => {
            insertNoteAttr.run({
              uid: Ulid.generate().toCanonical(),
              noteId,
              key,
              value,
            })
          })
        }

        insertCard.run({
          uid,
          deck: c.deck.join('::'),
          front: c.front,
          back: c.back,
          mnemonic: c.mnemonic,
          noteId,
          srsLevel: c.srsLevel,
          nextReview: c.nextReview ? +c.nextReview : null,
          rightStreak: c.rightStreak,
          wrongStreak: c.wrongStreak,
          lastRight: c.lastRight ? +c.lastRight : null,
          lastWrong: c.lastWrong ? +c.lastWrong : null,
          maxRight: c.maxRight,
          maxWrong: c.maxWrong,
        })
      })
    })()
  }

  search(q: string): any[] {
    const tokens = splitOp(q)

    const $and: ISplitOpToken[] = []
    const $or: ISplitOpToken[] = []
    const $not: ISplitOpToken[] = []

    for (const t of tokens) {
      switch (t.prefix) {
        case '+':
          $and.push(t)
          break
        case '-':
          $not.push(t)
          break
        default:
          $or.push(t)
      }
    }

    const params = new Map()

    const parseToken = (t: ISplitOpToken) => {
      if (
        t.k &&
        [
          'uid',
          'deck',
          'front',
          'back',
          'mnemonic',
          'srsLevel',
          'nextReview',
          'rightStreak',
          'wrongStreak',
          'lastRight',
          'lastWrong',
          'maxRight',
          'maxWrong',
        ].includes(t.k)
      ) {
        if (t.v === 'NULL') {
          return `[${t.k}] IS NULL`
        }

        let v: string | number | null = null

        if (['nextReview', 'lastRight', 'lastWrong'].includes(t.k)) {
          const m = /^(?<y>\d{4})(-(?<mo>\d{2})(-(?<d>\d{2})(T(?<h>\d{2}):(?<min>\d{2}))?)?)?$/.exec(
            t.v
          )

          if (m && m.groups) {
            const d = new Date(
              parseInt(m.groups.y),
              m.groups.mo ? parseInt(m.groups.mo) - 1 : 0,
              m.groups.d ? parseInt(m.groups.d) : 1,
              m.groups.h ? parseInt(m.groups.h) : 0,
              m.groups.min ? parseInt(m.groups.min) : 0
            )
            v = +d - d.getTimezoneOffset() * 60 * 1000 * 1000
          } else if (!/^\d+(\.\d+)?$/.test(t.v)) {
            v = +new Date(t.v)
          }
        } else if (
          [
            'srsLevel',
            'rightStreak',
            'wrongStreak',
            'maxRight',
            'maxWrong',
          ].includes(t.k)
        ) {
          v = parseInt(t.v)
        } else {
          t.v = removeBraces(t.v)

          if (t.op === ':') {
            params.set(params.size, t.v.replace(/[_%]/g, '[$&]'))
            return `[${t.k}] LIKE '%'||@${params.size - 1}||'%'`
          }
        }

        if (t.op === ':') {
          t.op = '='
        }

        params.set(params.size, v)
        return `[${t.k}] ${t.op} @${params.size - 1}`
      } else if (t.k) {
        params.set(params.size, removeBraces(t.k))
        t.v = removeBraces(t.v)

        if (t.op === ':') {
          params.set(params.size, t.v.replace(/[_%]/g, '[$&]'))
          return [
            `n.[key] = @${params.size - 2}`,
            `n.[value] LIKE '%'||@${params.size - 1}||'%'`,
          ].join(' AND ')
        } else {
          params.set(params.size, t.v)
          return [
            `n.[key] = @${params.size - 2}`,
            `n.[value] ${t.op} @${params.size - 1}`,
          ].join(' AND ')
        }
      } else {
        t.v = removeBraces(t.v)
        params.set(params.size, t.v.replace(/[_%]/g, '[$&]'))
        return `(${[
          `n.[value] LIKE '%'||@${params.size - 1}||'%'`,
          `[front] LIKE '%'||@${params.size - 1}||'%'`,
          `[back] LIKE '%'||@${params.size - 1}||'%'`,
          `[mnemonic] LIKE '%'||@${params.size - 1}||'%'`,
        ].join(' OR ')})`
      }
    }

    const $$and = $and.map((t) => parseToken(t))

    const $$or = $or.map((t) => parseToken(t)).join(' OR ')
    if ($$or) {
      $$and.push(`(${$$or})`)
    }

    const $$not = $not.map((t) => parseToken(t)).join(' AND ')
    if ($$not) {
      $$and.push(`NOT (${$$not})`)
    }

    const where = $$and.length ? $$and.join(' AND ') : 'TRUE'

    return this.db
      .prepare(
        /* sql */ `
      SELECT
        [card].[uid]    [id],
        [deck],
        [front],
        [back],
        [mnemonic],
        [srsLevel],
        [nextReview],
        [rightStreak],
        [wrongStreak],
        [lastRight],
        [lastWrong],
        [maxRight],
        [maxWrong],
        IIF(n.[key] IS NULL, NULL, json_group_object(n.[key], n.[value])) note
      FROM [card]
      LEFT JOIN [noteAttr] n ON n.[noteId] = [card].[noteId]
      WHERE ${where}
      GROUP BY [card].[uid]
      LIMIT 10
      `
      )
      .all(Object.fromEntries(params))
  }
}
