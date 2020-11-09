import sqlite from 'better-sqlite3'
import { Ulid } from 'id128'

import { ISplitOpToken, removeBraces, splitOp } from './tokenize'
import { IStatus } from './types'

export class LocalDb {
  private db: sqlite.Database

  constructor(public filename: string, options?: sqlite.Options) {
    this.db = sqlite(filename, options)

    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS [noteAttr] (
      [_id]         VARCHAR PRIMARY KEY,
      [noteId]      VARCHAR REFERENCES [note]([_id]),
      [key]         VARCHAR NOT NULL,
      [value]       VARCHAR NOT NULL,
      [updatedAt]   INT  -- epoch milliseconds
    );

    CREATE UNIQUE INDEX IF NOT EXISTS noteAttr_noteId_key ON [noteAttr]([noteId], [key]);
    `)

    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS [template] (
      [_id]         VARCHAR PRIMARY KEY,
      [front]       VARCHAR NOT NULL,
      [back]        VARCHAR,
      [shared]      VARCHAR,
      [updatedAt]   INT  -- epoch milliseconds
    );
    `)

    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS [quiz] (
      [_id]         VARCHAR PRIMARY KEY,
      [deck]        VARCHAR NOT NULL, -- :: separated
      [front]       VARCHAR,
      [back]        VARCHAR,
      [mnemonic]    VARCHAR,
      [noteId]      VARCHAR,
      [templateId]  VARCHAR REFERENCES [template]([_id]),
      [srsLevel]    INT,
      [nextReview]  INT,  -- epoch milliseconds
      [rightStreak] INT,
      [wrongStreak] INT,
      [lastRight]   INT,  -- epoch milliseconds
      [lastWrong]   INT,  -- epoch milliseconds
      [maxRight]    INT,
      [maxWrong]    INT,
      [updatedAt]   INT  -- epoch milliseconds
    );

    CREATE INDEX IF NOT EXISTS quiz_deck        ON [quiz]([deck]);
    CREATE INDEX IF NOT EXISTS quiz_noteId      ON [quiz]([noteId]);
    CREATE INDEX IF NOT EXISTS quiz_templateId  ON [quiz]([templateId]);
    CREATE INDEX IF NOT EXISTS quiz_srsLevel    ON [quiz]([srsLevel]);
    CREATE INDEX IF NOT EXISTS quiz_nextReview  ON [quiz]([nextReview]);
    CREATE INDEX IF NOT EXISTS quiz_rightStreak ON [quiz]([rightStreak]);
    CREATE INDEX IF NOT EXISTS quiz_wrongStreak ON [quiz]([wrongStreak]);
    CREATE INDEX IF NOT EXISTS quiz_lastRight   ON [quiz]([lastRight]);
    CREATE INDEX IF NOT EXISTS quiz_lastWrong   ON [quiz]([lastWrong]);
    CREATE INDEX IF NOT EXISTS quiz_maxRight    ON [quiz]([maxRight]);
    CREATE INDEX IF NOT EXISTS quiz_maxWrong    ON [quiz]([maxWrong]);
    `)

    this.db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS [preset] (
      [_id]       VARCHAR PRIMARY KEY,
      [q]         VARCHAR NOT NULL UNIQUE,
      [name]      VARCHAR NOT NULL UNIQUE,
      [status]    VARCHAR NOT NULL,  -- json
      [selected]  VARCHAR NOT NULL,  -- \x1f separated
      [opened]    VARCHAR NOT NULL,  -- \x1f separated
      [updatedAt]   INT  -- epoch milliseconds
    )
    `)
  }

  async presetQ() {
    return this.db
      .prepare(
        /* sql */ `
    SELECT
      [name],
      [q],
      [status]    statusJson,
      [selected]  selectedX1f,
      [opened]    openedX1f
    FROM [preset]
    ORDER BY [_id] DESC
    `
      )
      .all()
      .map(({ name, q, statusJson, selectedX1f, openedX1f }) => ({
        name: name as string,
        q: q as string,
        status: JSON.parse(statusJson) as IStatus,
        selected: selectedX1f.split('\x1f') as string[],
        opened: openedX1f.split('\x1f') as string[]
      }))
  }

  async presetInsert({
    name,
    q,
    status,
    selected,
    opened
  }: {
    name: string
    q: string
    status: IStatus
    selected: string[]
    opened: string[]
  }): Promise<string> {
    const id = Ulid.generate().toCanonical()
    this.db
      .prepare(
        /* sql */ `
    INSERT INTO [preset] (
      [_id],
      [name],
      [q],
      [status],
      [selected],
      [opened]
    ) VALUES (
      @id, @name, @q, @status, @selected, @opened
    )
    `
      )
      .run({
        id,
        name,
        q,
        status: JSON.stringify(status),
        selected: selected.join('\x1f'),
        opened: opened.join('\x1f')
      })

    return id
  }

  async presetUpdate(
    id: string,
    {
      q,
      status,
      selected,
      opened
    }: {
      q: string
      status: IStatus
      selected: string[]
      opened: string[]
    }
  ) {
    return this.db
      .prepare(
        /* sql */ `
    UPDATE [preset]
    SET
      [q]         = @q,
      [status]    = @status,
      [selected]  = @selected,
      [opened]    = @opened,
      [updatedAt] = @updatedAt
    WHERE
      [_id] = @id
    `
      )
      .run({
        id,
        q,
        status: JSON.stringify(status),
        selected: selected.join('\x1f'),
        opened: opened.join('\x1f'),
        updatedAt: +new Date()
      })
  }

  async presetDelete(id: string) {
    return this.db
      .prepare(
        /* sql */ `
    DELETE FROM [preset]
    WHERE [_id] = @id
    `
      )
      .run({ id })
  }

  async quizQ(
    decks: string[],
    {
      status,
      q
    }: {
      status: IStatus
      q: string
    }
  ) {
    const params = new Map<number, any>()

    const $and = decks.map((d, i) => {
      const k = params.size
      params.set(k, d)
      return `([deck] = @${k} OR ([deck] > @${k}||'::' AND [deck] < @${k}||':;'))`
    })
    $and.push(this._parseStatus(params, status))
    $and.push(this._parseQ(params, q))

    const where = $and.join(' AND ')

    return this.db
      .prepare(
        /* sql */ `
    SELECT
      [quiz].[_id]    [id]
    FROM [quiz]
    LEFT JOIN [noteAttr] n ON n.[noteId] = [quiz].[noteId]
    WHERE ${where}
    GROUP BY [quiz].[_id]
    `
      )
      .all(Object.fromEntries(params))
      .map(({ id }) => id as string)
  }

  async treeviewQ({ status, q }: { status: IStatus; q: string }) {
    const params = new Map<number, any>()

    const $and = [this._parseStatus(params, status), this._parseQ(params, q)]
    const where = $and.join(' AND ')

    const now = +new Date()

    return this.db
      .prepare(
        /* sql */ `
      SELECT
        [deck],
        json_group_array(
          json_object(
            'srsLevel', [srsLevel],
            'nextReview', [nextReview],
            'wrongStreak', [wrongStreak]
          )
        ) [jsonStat]
      FROM (
        SELECT
          [quiz].[_id]    [id],
          [deck],
          [srsLevel],
          [nextReview],
          [wrongStreak]
        FROM [quiz]
        LEFT JOIN [noteAttr] n ON n.[noteId] = [quiz].[noteId]
        WHERE ${where}
        GROUP BY [quiz].[_id]
      )
      GROUP BY [deck]
      `
      )
      .all(Object.fromEntries(params))
      .map(({ deck, jsonStat }) => {
        const stat = JSON.parse(jsonStat) as {
          srsLevel: number | null
          nextReview: number | null
          wrongStreak: number | null
        }[]

        return {
          deck: (deck as string).split(/::/g),
          new: stat.filter((s) => s.srsLevel === null).length,
          due: stat.filter((s) => s.nextReview && s.nextReview < now).length,
          leech: stat.filter(
            (s) => s.srsLevel === 0 || (s.wrongStreak && s.wrongStreak > 2)
          ).length
        }
      })
  }

  private _parseStatus(params: Map<number, any>, status: IStatus): string {
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
      return 'TRUE'
    }

    const $and: string[] = [`(${$or.join(' OR ')})`]

    if (status.due) {
      const k = params.size
      params.set(k, +new Date())
      $and.push(`[nextReview] < @${k}`)
    }

    return $and.length > 0 ? $and.join(' AND ') : 'TRUE'
  }

  private _parseQ(params: Map<number, any>, q: string): string {
    const $and: ISplitOpToken[] = []
    const $or: ISplitOpToken[] = []
    const $not: ISplitOpToken[] = []

    for (const t of splitOp(q)) {
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
      if (
        t.k &&
        [
          'id',
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
          'maxWrong'
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
            'maxWrong'
          ].includes(t.k)
        ) {
          v = parseInt(t.v)
        } else {
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

        if (t.op === ':') {
          params.set(params.size, t.v.replace(/[_%]/g, '[$&]'))
          return [
            `n.[key] = @${params.size - 2}`,
            `n.[value] LIKE '%'||@${params.size - 1}||'%'`
          ].join(' AND ')
        } else {
          params.set(params.size, t.v)
          return [
            `n.[key] = @${params.size - 2}`,
            `n.[value] ${t.op} @${params.size - 1}`
          ].join(' AND ')
        }
      } else {
        params.set(params.size, t.v.replace(/[_%]/g, '[$&]'))
        return `(${[
          `n.[value] LIKE '%'||@${params.size - 1}||'%'`,
          `[front] LIKE '%'||@${params.size - 1}||'%'`,
          `[back] LIKE '%'||@${params.size - 1}||'%'`,
          `[mnemonic] LIKE '%'||@${params.size - 1}||'%'`
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

    return $$and.length ? $$and.join(' AND ') : 'TRUE'
  }
}
