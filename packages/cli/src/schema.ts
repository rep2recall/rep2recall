import crypto from 'crypto'

import { Db, Table, primary, prop, Entity } from 'liteorm'
import nanoid from 'nanoid'
import SparkMD5 from 'spark-md5'
import stringify from 'fast-json-stable-stringify'

@Entity({ name: 'user', timestamp: true })
class DbUser {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ null: true }) email?: string
  @prop({ default: () => crypto.randomBytes(48).toString('base64') }) secret?: string
  @prop({ null: true }) picture?: string
}

export const dbUser = new Table<DbUser, { createdAt: Date; updatedAt: Date }>(DbUser)

@Entity({ name: 'deck', timestamp: true })
class DbDeck {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: dbUser }) userId!: string
  @prop() name!: string
}

export const dbDeck = new Table<DbDeck, { createdAt: Date; updatedAt: Date }>(DbDeck)

@Entity({ name: 'source', timestamp: true })
class DbSource {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: dbUser }) userId!: string
  @prop() name!: string
  @prop({ null: true, unique: true }) h?: string
}

export const dbSource = new Table<DbSource, { createdAt: Date; updatedAt: Date }>(DbSource)

@Entity({ name: 'template', timestamp: true })
class DbTemplate {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: dbUser }) userId!: string
  @prop({ references: dbSource, null: true }) sourceId?: string
  @prop() name!: string
  @prop() front!: string
  @prop({ null: true }) back?: string
  @prop({ null: true }) css?: string
  @prop({ null: true }) js?: string
}

export const dbTemplate = new Table<DbTemplate, { createdAt: Date; updatedAt: Date }>(DbTemplate)

@Entity({ name: 'note', timestamp: true })
class DbNote {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: dbUser }) userId!: string
  @prop({ references: dbSource, null: true }) sourceId?: string
  @prop({
    unique: true,
    default: ({ data }) => hash(data),
    onUpdate: ({ data }) => hash(data),
  }) h!: string

  @prop() order!: Record<string, number>
  @prop() data!: Record<string, any>
}

export const dbNote = new Table<DbNote, { createdAt: Date; updatedAt: Date }>(DbNote)

@Entity({ name: 'media', timestamp: true })
class DbMedia {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: dbUser }) userId!: string
  @prop({ references: dbSource, null: true }) sourceId?: string
  @prop() name!: string
  @prop({
    unique: true,
    default: ({ data }) => hash(data),
    onUpdate: ({ data }) => data ? hash(data) : undefined,
  }) h?: string

  @prop() data!: ArrayBuffer
}

export const dbMedia = new Table<DbMedia, { createdAt: Date; updatedAt: Date }>(DbMedia)

@Entity({ name: 'card', timestamp: true })
class DbCard {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: dbUser }) userId!: string
  @prop({ references: dbDeck }) deckId!: string
  @prop({ references: dbTemplate, null: true }) templateId?: string
  @prop({ references: dbNote, null: true }) noteId?: string
  @prop() front!: string
  @prop({ null: true }) back?: string
  @prop({ null: true }) mnemonic?: string
  @prop({ null: true, type: 'int' }) srsLevel?: number
  @prop({ null: true }) nextReview?: Date
  @prop({ type: 'StringArray', default: () => [] }) tag?: string[]
  @prop({ default: () => ({ streak: { right: 0, wrong: 0 } }) }) stat?: {
      streak: {right: number; wrong: number}
  }
}

export const dbCard = new Table<DbCard, { createdAt: Date; updatedAt: Date }>(DbCard)

export let db: Db

export async function initDatabase (filename: string) {
  db = await Db.connect(filename)
  await db.init([dbUser, dbSource, dbDeck, dbTemplate, dbNote, dbMedia, dbCard])
}

function hash (obj: any) {
  if (obj instanceof ArrayBuffer) {
    return SparkMD5.ArrayBuffer.hash(obj)
  } else {
    return SparkMD5.hash(stringify(obj))
  }
}
