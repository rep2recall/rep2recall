import { ISplitOpToken, removeBraces, splitOp } from './tokenize'

import { Ulid } from 'id128'
import sqlite from 'better-sqlite3'

export interface ICard {
  deck: string[]
  front?: string
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
    CREATE TABLE [card] (
      [uid]         VARCHAR PRIMARY KEY,
      [deck]        VARCHAR NOT NULL,  -- :: separated
      [front]       VARCHAR,
      [back]        VARCHAR,
      [mnemonic]    VARCHAR,
      [noteId]      VARCHAR,
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
    CREATE VIRTUAL TABLE [q] USING FTS5(
      [uid],
      [deck],
      [front],
      [back],
      [mnemonic],
      tokenize = "unicode61 separators ':./'"
    );
    `)

    this.db.exec(/* sql */ `
    CREATE VIRTUAL TABLE [noteAttr] USING FTS5(
      [noteId],
      [key],
      [value],
      tokenize = "unicode61 separators ':./'"
    )
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

    const insertQ = this.db.prepare(/* sql */ `
    INSERT INTO [q] (
      [uid],
      [deck],
      [front],
      [back],
      [mnemonic]
    ) VALUES (
      @uid,
      @deck,
      @front,
      @back,
      @mnemonic
    )
    `)

    const insertNoteAttr = this.db.prepare(/* sql */ `
    INSERT INTO [noteAttr] (
      [noteId],
      [key],
      [value]
    ) VALUES (
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
            insertNoteAttr.run({ noteId, key, value })
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

        insertQ.run({
          uid,
          deck: c.deck.join('::'),
          front: c.front,
          back: c.back,
          mnemonic: c.mnemonic,
        })
      })
    })()
  }

  search(q: string): any[] {
    const tCard: ISplitOpToken[] = []
    const tQ: ISplitOpToken[] = []
    const tNoteAttr: ISplitOpToken[] = []

    const tokens = splitOp(q)

    for (const t of tokens) {
      let isParsed = false

      if (t.k) {
        if (['uid', 'deck', 'front', 'back', 'mnemonic'].includes(t.k)) {
          tQ.push(t)
          isParsed = true
        } else if (
          [
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
          tCard.push(t)
          isParsed = true
        }
      }

      if (!isParsed) {
        tNoteAttr.push(t)
      }
    }

    const uids: string[] | null = (() => {
      if (!tQ.length) {
        return null
      }

      const $and: ISplitOpToken[] = []
      const $or: ISplitOpToken[] = []
      const $not: ISplitOpToken[] = []

      for (const t of tQ) {
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

      const parseToken = (t: ISplitOpToken) => {
        if (!t.k) {
          throw new Error('no k')
        }

        return `"${t.k}" : "${t.v.replace(/"/g, '""')}"`
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

      if (!$and.length) {
        return null
      }

      return this.db
        .prepare(
          /* sql */ `
      SELECT [uid]
      FROM [q]
      WHERE [q] MATCH ?
      `
        )
        .all([$$and.join(' AND ')])
        .map(({ uid }) => uid)
    })()

    if (uids && !uids.length) {
      return []
    }

    const noteIds: string[] | null = (() => {
      if (!tNoteAttr.length) {
        return null
      }

      const $and: ISplitOpToken[] = []
      const $or: ISplitOpToken[] = []
      const $not: ISplitOpToken[] = []

      for (const t of tNoteAttr) {
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

      const parseToken = (t: ISplitOpToken) => {
        if (t.k) {
          return (
            `("key" : "${removeBraces(t.k).replace(/"/g, '""')}") AND ` +
            `("value" : "${t.v.replace(/"/g, '""')}")`
          )
        }

        return `("value" : "${t.v.replace(/"/g, '""')}")`
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

      console.log($$and)

      return this.db
        .prepare(
          /* sql */ `
      SELECT [noteId]
      FROM [noteAttr]
      WHERE [noteAttr] MATCH ?
      `
        )
        .all([$$and.join(' AND ')])
        .map(({ noteId }) => noteId)
    })()

    if (noteIds && !noteIds.length) {
      return []
    }

    const $and: ISplitOpToken[] = []
    const $or: ISplitOpToken[] = []
    const $not: ISplitOpToken[] = []

    for (const t of tCard) {
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
      if (!t.k) {
        throw new Error('no k')
      }

      if (t.v === 'NULL') {
        return `[${t.k}] IS NULL`
      }

      let v: number | null = null

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
      } else {
        v = parseInt(t.v)
      }

      params.set(params.size, v)
      return `[${t.k}] ${t.op} @${params.size - 1}`
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

    if (noteIds) {
      $$and.unshift(
        `n.[noteId] IN (${noteIds
          .map((u) => {
            params.set(params.size, u)
            return `@${params.size - 1}`
          })
          .join(',')})`
      )
    }

    if (uids) {
      $$and.unshift(
        `[uid] IN (${uids
          .map((u) => {
            params.set(params.size, u)
            return `@${params.size - 1}`
          })
          .join(',')})`
      )
    }

    const where = $$and.length ? $$and.join(' AND ') : 'TRUE'

    return this.db
      .prepare(
        /* sql */ `
      SELECT
        [uid],
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
      LEFT JOIN [noteAttr] n ON n.[noteId] = [card].noteId
      WHERE ${where}
      GROUP BY [uid]
      LIMIT 10
      `
      )
      .all(Object.fromEntries(params))
  }
}
