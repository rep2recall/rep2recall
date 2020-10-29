import sqlite from 'better-sqlite3'

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
  }
}
