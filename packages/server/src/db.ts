import crypto from 'crypto'

import { Db, Table, primary, prop } from 'liteorm'
import nanoid from 'nanoid'

@Table({ name: 'user', timestamp: true })
class DbUser {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ null: true }) email?: string
  @prop({ default: () => crypto.randomBytes(48).toString('base64') }) secret?: string
  @prop({ null: true }) picture?: string
}

@Table({ name: 'deck', timestamp: true })
class DbDeck {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: 'user(_id)' }) userId!: string
  @prop() name!: string
}

@Table({ name: 'source', timestamp: true })
class DbSource {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: 'user(_id)' }) userId!: string
  @prop() name!: string
  @prop({ null: true, unique: true }) h?: string
}

@Table({ name: 'template', timestamp: true })
class DbTemplate {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: 'user(_id)' }) userId!: string
  @prop({ references: 'source(_id)', null: true }) sourceId?: string
  @prop() name!: string
  @prop() front!: string
  @prop({ null: true }) back?: string
  @prop({ null: true }) css?: string
  @prop({ null: true }) js?: string
}

@Table({ name: 'note', timestamp: true })
class DbNote {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: 'user(_id)' }) userId!: string
  @prop({ references: 'source(_id)', null: true }) sourceId?: string
  @prop({ unique: true }) key!: string
  @prop() order!: Record<string, number>
  @prop() data!: Record<string, any>
}

@Table({ name: 'media', timestamp: true })
class DbMedia {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: 'user(_id)' }) userId!: string
  @prop({ references: 'source(_id)', null: true }) sourceId?: string
  @prop() name!: string
  @prop({ null: true, unique: true }) h?: string
  @prop() data!: ArrayBuffer
}

@Table({ name: 'card', timestamp: true })
class DbCard {
  @primary({ default: () => nanoid() }) _id?: string
  @prop({ references: 'user(_id)' }) userId!: string
  @prop({ references: 'deck(_id)' }) deckId!: string
  @prop({ references: 'template(_id)', null: true }) templateId?: string
  @prop({ references: 'note(_id)', null: true }) noteId?: string
  @prop() front!: string
  @prop({ null: true }) back?: string
  @prop({ null: true }) mnemonic?: string
  @prop({ null: true }) srsLevel?: number
  @prop({ null: true }) nextReview?: Date
  @prop({ type: 'strArray', default: () => [] }) tag?: string[]
  @prop({ default: () => ({ streak: { right: 0, wrong: 0 } }) }) stat?: {
      streak: {right: number; wrong: number}
  }
}

export async function initDatabase (filename: string) {
  const db = await Db.connect(filename)

  return {
    db,
    cols: {
      user: await db.collection(new DbUser()),
      source: await db.collection(new DbSource()),
      deck: await db.collection(new DbDeck()),
      template: await db.collection(new DbTemplate()),
      note: await db.collection(new DbNote()),
      media: await db.collection(new DbMedia()),
      card: await db.collection(new DbCard()),
    },
  }
}
