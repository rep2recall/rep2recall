import sqlite from 'better-sqlite3'

import { IStatus } from './types'

export class LocalDb {
  private db: sqlite.Database

  constructor (public filename: string, options?: sqlite.Options) {
    this.db = sqlite(filename, options)

    this.db.exec(/* sql */`
    CREATE TABLE IF NOT EXISTS [noteAttr] (
      [_id]         VARCHAR PRIMARY KEY,  -- ULID / sortable UUID
      [noteId]      VARCHAR REFERENCES [note]([_id]),
      [key]         VARCHAR NOT NULL,
      [value]       VARCHAR NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS noteAttr_noteId_key ON [noteAttr]([noteId], [key]);
    `)

    this.db.exec(/* sql */`
    CREATE TABLE IF NOT EXISTS [note] (
      [_id]         VARCHAR PRIMARY KEY
    );
    `)

    this.db.exec(/* sql */`
    CREATE TABLE IF NOT EXISTS [template] (
      [_id]         VARCHAR PRIMARY KEY,
      [front]       VARCHAR NOT NULL,
      [back]        VARCHAR,
      [shared]      VARCHAR
    );
    `)

    this.db.exec(/* sql */`
    CREATE TABLE IF NOT EXISTS [card] (
      [_id]         VARCHAR PRIMARY KEY,
      [deck]        VARCHAR NOT NULL,
      [front]       VARCHAR,
      [back]        VARCHAR,
      [mnemonic]    VARCHAR,
      [noteId]      VARCHAR REFERENCES [note]([_id]),
      [templateId]  VARCHAR REFERENCES [template]([_id]),
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
    CREATE INDEX IF NOT EXISTS card_templateId  ON [card]([templateId]);
    CREATE INDEX IF NOT EXISTS card_srsLevel    ON [card]([srsLevel]);
    CREATE INDEX IF NOT EXISTS card_nextReview  ON [card]([nextReview]);
    CREATE INDEX IF NOT EXISTS card_rightStreak ON [card]([rightStreak]);
    CREATE INDEX IF NOT EXISTS card_wrongStreak ON [card]([wrongStreak]);
    CREATE INDEX IF NOT EXISTS card_lastRight   ON [card]([lastRight]);
    CREATE INDEX IF NOT EXISTS card_lastWrong   ON [card]([lastWrong]);
    CREATE INDEX IF NOT EXISTS card_maxRight    ON [card]([maxRight]);
    CREATE INDEX IF NOT EXISTS card_maxWrong    ON [card]([maxWrong]);
    `)

    this.db.exec(/* sql */`
    CREATE TABLE IF NOT EXISTS [preset] (
      [_id]       VARCHAR PRIMARY KEY, -- ULID / sortable ID
      [q]         VARCHAR NOT NULL UNIQUE,
      [name]      VARCHAR NOT NULL UNIQUE,
      [status]    VARCHAR NOT NULL, -- json
      [selected]  VARCHAR NOT NULL, -- \x1f
      [opened]    VARCHAR NOT NULL  -- \x1f
    )
    `)
  }

  async tagQ () {
    return this.db.prepare(/* sql */`
    SELECT
      [name],
      [q],
      [status]    statusJson,
      [selected]  selectedX1f,
      [opened]    openedX1f
    FROM [preset]
    ORDER BY [_id] DESC
    `).all().map(({
      name, q, statusJson, selectedX1f, openedX1f
    }) => ({
      name: name as string,
      q: q as string,
      status: JSON.parse(statusJson) as IStatus,
      itemSelected: selectedX1f.split('\x1f') as string[],
      itemOpened: openedX1f.split('\x1f') as string[]
    }))
  }

  async queryQuiz (
    decks: string[],
    status: IStatus
  ) {
    const params = new Map<string, any>()

    const $or: string[] = []

    const srsLevelRange: string[] = []

    if (status.new) {
      srsLevelRange.push('[srsLevel] IS NULL')
    }

    if (status.graduated) {
      srsLevelRange.push('[srsLevel] IS NOT NULL')
    } else {
      srsLevelRange.push('[srsLevel] <= 3')
    }

    if (srsLevelRange.length > 0) {
      $or.push(srsLevelRange.join(' AND '))
    }

    if (status.leech) {
      $or.push('([srsLevel] = 0 OR [wrongStreak] > 2)')
    }

    if ($or.length === 0) {
      return []
    }

    const $and: string[] = [`(${$or.join(' OR ')})`]

    $and.push(...decks.map((d, i) => {
      const k = params.size.toString()
      params.set(k, d)
      return `([deck] = :${k} OR ([deck] > :${k}||'\x1f' AND [deck] < :${k}||'\x20'))`
    }))

    if (status.due) {
      const k = params.size.toString()
      params.set(k, +new Date())
      $and.push(`[nextReview] < :${k}`)
    }

    return this.db.prepare(/* sql */`
    SELECT [_id] [id]
    FROM [quiz]
    WHERE ${$and.join(' AND ')}
    ORDER BY [_id] DESC
    `).all({ ...params }).map(({ id }) => id as string)
  }
}
