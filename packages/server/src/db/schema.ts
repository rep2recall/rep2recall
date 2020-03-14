import { Db as LiteOrm, Table, primary, prop, Entity } from 'liteorm'
import nanoid from 'nanoid'

import { hash } from '../utils'

@Entity({ name: 'deck', timestamp: true })
class DbDeck {
  @primary({ autoincrement: true }) id?: number
  @prop() name!: string
}

export const dbDeck = new Table(DbDeck)

@Entity<DbSource>({ name: 'source', timestamp: true })
class DbSource {
  @primary({ autoincrement: true }) id?: number
  @prop() name!: string
  @prop({ null: true, unique: true }) h?: string
}

export const dbSource = new Table(DbSource)

@Entity<DbTemplate>({ name: 'template', timestamp: true })
class DbTemplate {
  @primary({ autoincrement: true }) id?: number
  @prop({ references: dbSource, null: true }) sourceId?: number
  @prop() name!: string
  @prop() qfmt!: string
  @prop({ null: true }) afmt?: string
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
  @primary({ autoincrement: true }) id?: number
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
  @primary({ autoincrement: true }) id?: number
  @prop({ references: dbSource, null: true }) sourceId?: number
  @prop() name!: string
  @prop({ unique: true }) h!: string
}

export const dbMedia = new Table(DbMedia)

@Entity({ name: 'card', timestamp: true })
class DbCard {
  @primary({ autoincrement: true }) id?: number
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

  @prop({ default: () => [] }) attachments?: number[]
}

export const dbCard = new Table(DbCard)

class Db {
  db: LiteOrm

  constructor (filename: string) {
    this.db = new LiteOrm(filename)
  }

  async init () {
    return await this.db.init([dbSource, dbDeck, dbTemplate, dbNote, dbMedia, dbCard])
  }

  async find (cond: any) {
    return this.db.all(dbCard, {
      to: dbDeck,
      from: dbCard.c.deckId,
      type: 'left',
    }, {
      to: dbTemplate,
      from: dbCard.c.templateId,
      type: 'left',
    }, {
      to: dbNote,
      from: dbCard.c.noteId,
      type: 'left',
    }, {
      to: dbSource,
      from: dbNote.c.sourceId,
      type: 'left',
    })(cond, {
      guid: dbCard.c.guid,
      deck: dbDeck.c.name,
      template: dbTemplate.c.name,
      qfmt: dbTemplate.c.qfmt,
      afmt: dbTemplate.c.afmt,
      css: dbTemplate.c.css,
      js: dbTemplate.c.js,
      data: dbNote.c.data,
      order: dbNote.c.order,
      source: dbSource.c.name,
      sourceH: dbSource.c.h,
      front: dbCard.c.front,
      back: dbCard.c.back,
      mnemonic: dbCard.c.mnemonic,
      srsLevel: dbCard.c.srsLevel,
      nextReview: dbCard.c.nextReview,
      tag: dbCard.c.tag,
      stat: dbCard.c.stat,
      attachments: dbCard.c.attachments,
    })
  }
}

export let db: Db

export async function initDatabase (filename: string) {
  db = new Db(filename)
  await db.init()
}
