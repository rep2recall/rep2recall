import crypto from 'crypto'

import { Db, Table, primary, prop, Entity } from 'liteorm'
import { Serialize } from 'any-serialize'
import nanoid from 'nanoid'

const ser = new Serialize()

@Entity({ name: 'deck', timestamp: true })
class DbDeck {
  @primary({ autoincrement: true }) _id?: number
  @prop() name!: string
}

export const dbDeck = new Table(DbDeck)

@Entity<DbSource>({ name: 'source', timestamp: true })
class DbSource {
  @primary({ autoincrement: true }) _id?: number
  @prop() name!: string
  @prop({ null: true, unique: true }) h?: string
}

export const dbSource = new Table(DbSource)

@Entity<DbTemplate>({ name: 'template', timestamp: true })
class DbTemplate {
  @primary({ autoincrement: true }) _id?: number
  @prop({ references: dbSource, null: true }) sourceId?: number
  @prop() name!: string
  @prop() front!: string
  @prop({ null: true }) back?: string
  @prop({ null: true }) css?: string
  @prop({ null: true }) js?: string
  @prop({
    default: ({ front, back, css, js }) => {
      return hash({ front, back, css, js })
    },
    unique: true,
  }) h?: string
}

export const dbTemplate = new Table(DbTemplate)

@Entity<DbNote>({ name: 'note', timestamp: true })
class DbNote {
  @primary({ autoincrement: true }) _id?: number
  @prop({ references: dbSource, null: true }) sourceId?: number
  @prop({
    onChange: ({ data }) => data ? hash(data) : undefined,
    unique: true,
  }) h?: string

  @prop() order!: Record<string, number>
  @prop() data!: Record<string, any>
}

export const dbNote = new Table(DbNote)

@Entity<DbMedia>({ name: 'media', timestamp: true })
class DbMedia {
  @primary({ autoincrement: true }) _id?: number
  @prop({ references: dbSource, null: true }) sourceId?: number
  @prop() name!: string
  @prop({ unique: true }) h!: string
}

export const dbMedia = new Table(DbMedia)

@Entity({ name: 'card', timestamp: true })
class DbCard {
  @primary({ autoincrement: true }) _id?: number
  @prop({ default: () => nanoid() }) guid?: string
  @prop({ references: dbDeck }) deckId!: number
  @prop({ references: dbTemplate, null: true }) templateId?: number
  @prop({ references: dbNote, null: true }) noteId?: number
  @prop({ null: true }) front?: string
  @prop({ null: true }) back?: string
  @prop({ null: true }) mnemonic?: string
  @prop({ null: true, type: 'int' }) srsLevel?: number
  @prop({ null: true }) nextReview?: Date
  @prop({ type: 'StringArray', default: () => [] }) tag?: string[]
  @prop({ default: () => ({ streak: { right: 0, wrong: 0 } }) }) stat?: {
      streak: {
        right: number
        wrong: number
      }
  }
}

export const dbCard = new Table(DbCard)

export let db: Db

export async function initDatabase (filename: string) {
  db = new Db(filename)
  await db.init([dbSource, dbDeck, dbTemplate, dbNote, dbMedia, dbCard])
}

export function hash (obj: any) {
  const hash = crypto.createHash('sha256')

  if (obj instanceof ArrayBuffer) {
    return hash.update(Buffer.from(obj)).digest('base64')
  } else {
    return hash.update(ser.stringify(obj)).digest('base64')
  }
}
