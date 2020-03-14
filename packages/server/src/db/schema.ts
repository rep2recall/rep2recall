import path from 'path'

import { Db as LiteOrm, Table, primary, prop, Entity, UndefinedEqNull } from 'liteorm'
import nanoid from 'nanoid'
import { String, Number } from 'runtypes'
import fs from 'fs-extra'

import { hash, mapAsync, distinctBy } from '../utils'
import { mediaPath } from '../config'

@Entity({ name: 'deck', timestamp: true })
class DbDeck {
  @primary({ type: 'int' }) id?: number
  @prop() name!: string
}

export const dbDeck = new Table(DbDeck)

@Entity<DbSource>({ name: 'source', timestamp: true })
class DbSource {
  @primary({ type: 'int' }) id?: number
  @prop() name!: string
  @prop({ null: true, unique: true }) h?: string
}

export const dbSource = new Table(DbSource)

@Entity<DbTemplate>({ name: 'template', timestamp: true })
class DbTemplate {
  @primary({ type: 'int' }) id?: number
  @prop({ references: dbSource, null: true }) sourceId?: number
  @prop() name!: string
  @prop() qfmt!: string
  @prop({ null: true }) afmt?: string
  @prop({ null: true }) css?: string
  @prop({ null: true }) js?: string
  @prop({ unique: true }) h!: string
}

export const dbTemplate = new Table(DbTemplate)

@Entity<DbNote>({ name: 'note', timestamp: true })
class DbNote {
  @primary({ type: 'int' }) id?: number
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
  @primary({ type: 'int' }) id?: number
  @prop({ references: dbSource, null: true }) sourceId?: number
  @prop() name!: string
  @prop({ unique: true, default: () => nanoid() }) h?: string
}

export const dbMedia = new Table(DbMedia)

@Entity({ name: 'card', timestamp: true })
class DbCard {
  @primary({ type: 'int' }) id?: number
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

export interface IEntry {
  id?: number
  guid?: string
  deck: string
  template?: string
  templateH?: string
  qfmt?: string
  afmt?: string
  css?: string
  js?: string
  data?: Record<string, any>
  order?: Record<string, number>
  source?: string
  sourceH?: string
  front?: string
  back?: string
  mnemonic?: string
  srsLevel?: number
  nextReview?: Date
  tag?: string[]
  stat?: {
    streak: {
      right: number
      wrong: number
    }
  }
  attachments?: (number | {
    name?: string
    path: string
  })[]
}

class Db {
  db: LiteOrm

  constructor (filename: string) {
    this.db = new LiteOrm(filename)
  }

  async init () {
    return await this.db.init([dbSource, dbDeck, dbTemplate, dbNote, dbMedia, dbCard])
  }

  async find (cond: any): Promise<UndefinedEqNull<Partial<IEntry>>[]> {
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
      id: dbCard.c.id,
      guid: dbCard.c.guid,
      deck: dbDeck.c.name,
      template: dbTemplate.c.name,
      templateH: dbTemplate.c.h,
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

  async insert (...entries: IEntry[]) {
    const mapSourceHtoId: Record<string, number> = {}

    await mapAsync(distinctBy(entries.filter((ent) => ent.sourceH), 'sourceH'), async (ent) => {
      const sourceH = String.check(ent.sourceH)

      try {
        mapSourceHtoId[sourceH] = await this.db.create(dbSource)({
          name: String.check(ent.source),
          h: sourceH,
        })
      } catch (_) {
        mapSourceHtoId[sourceH] = (await this.db.first(dbSource)({
          h: sourceH,
        }, {
          id: dbSource.c.id,
        })).id!
      }
    })

    const mapNoteHtoId: Record<string, number> = {}

    await mapAsync(distinctBy(entries.filter((ent) => ent.data), 'data'), async (ent) => {
      const h = hash(ent.data)

      try {
        mapNoteHtoId[h] = await this.db.create(dbNote)({
          data: ent.data!,
          order: ent.order || {},
          h,
          sourceId: ent.sourceH ? mapSourceHtoId[ent.sourceH] : undefined,
        })
      } catch (_) {
        mapNoteHtoId[h] = (await this.db.first(dbNote)({ h }, {
          id: dbNote.c.id,
        })).id!
      }
    })

    const mapTemplateHToId: Record<string, number> = {}

    await mapAsync(distinctBy(entries.filter((ent) => ent.templateH), 'templateH'), async (ent) => {
      const templateH = String.check(ent.templateH)

      try {
        mapTemplateHToId[templateH] = await this.db.create(dbTemplate)({
          name: String.check(ent.template),
          h: templateH,
          qfmt: String.check(ent.qfmt),
          afmt: ent.afmt,
          css: ent.css,
          js: ent.js,
          sourceId: ent.sourceH ? mapSourceHtoId[ent.sourceH] : undefined,
        })
      } catch (_) {
        mapTemplateHToId[templateH] = (await this.db.first(dbTemplate)({
          h: templateH,
        }, {
          id: dbTemplate.c.id,
        })).id!
      }
    })

    const mapDeckNameToId: Record<string, number> = {}

    await mapAsync(distinctBy(entries, 'deck'), async (ent) => {
      try {
        mapDeckNameToId[ent.deck] = (await this.db.first(dbDeck)({ name: ent.deck }, {
          id: dbDeck.c.id,
        })).id!
      } catch (_) {
        mapDeckNameToId[ent.deck] = await this.db.create(dbDeck)({
          name: ent.deck,
        })
      }
    })

    const mapAttachmentPathToId: Record<string, number> = {}

    await mapAsync(entries
      .filter((ent) => Array.isArray(ent.attachments))
      .reduce((prev, c) => [...prev, ...c.attachments!], [] as any[])
      .filter((att) => typeof att === 'object'), async ({ name, path }) => {
      try {
        mapAttachmentPathToId[path] = await this.uploadMedia(path, {
          filename: name,
        })
      } catch (e) {
        console.error(e)
      }
    })

    const cardIds: number[] = []

    await mapAsync(entries, async (ent) => {
      try {
        const noteH = ent.data ? hash(ent.data) : undefined

        cardIds.push(await this.db.create(dbCard)({
          guid: ent.guid,
          deckId: Number.check(mapDeckNameToId[ent.deck]),
          templateId: ent.templateH ? mapTemplateHToId[ent.templateH] : undefined,
          noteId: noteH ? mapNoteHtoId[noteH] : undefined,
          front: ent.front,
          back: ent.back,
          mnemonic: ent.mnemonic,
          srsLevel: ent.srsLevel,
          nextReview: ent.nextReview,
          tag: ent.tag,
          stat: ent.stat,
          attachments: ent.attachments ? ent.attachments.map((att) => {
            if (typeof att === 'number') {
              return att
            } else {
              return mapAttachmentPathToId[att.path]
            }
          }).filter((att) => att !== undefined) : undefined,
        }))
      } catch (e) {
        console.error(e)
      }
    })

    return cardIds
  }

  async uploadMedia (f: string | Buffer, opts: {
    filename?: string
    makeUnique?: boolean
    sourceId?: number
  } = {}) {
    let { filename, makeUnique, sourceId } = opts

    if (!filename || makeUnique) {
      filename = (() => {
        const p = path.parse(filename || path.basename(String.check(f)))
        return p.name + '_' + Math.random().toString(36).substr(2) + p.ext
      })()
    }

    fs.ensureFileSync(path.join(mediaPath, filename))

    let b: Buffer

    if (typeof f === 'string') {
      fs.copyFileSync(f, path.join(mediaPath, filename))
      b = fs.readFileSync(f)
    } else {
      fs.writeFileSync(path.join(mediaPath, filename), f)
      b = f
    }

    return await this.db.create(dbMedia)({
      name: filename,
      h: hash(b),
      sourceId,
    })
  }

  async export (cond: Record<string, any>, dst: string) {
  }
}

export let db: Db

export async function initDatabase (filename: string) {
  db = new Db(filename)
  await db.init()
}
