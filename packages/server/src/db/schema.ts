import path from 'path'

import { Db as LiteOrm, Table, primary, prop, Entity, UndefinedEqNull } from 'liteorm'
import nanoid from 'nanoid'
import { String, Number } from 'runtypes'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import dayjs from 'dayjs'
import { ankiMustache } from '@patarapolw/blogdown-make-html/dist/mustache'
import QSearch from '@patarapolw/qsearch'

import { hash, mapAsync, distinctBy, chunk, ser } from '../utils'
import { mediaPath, tmpPath } from '../config'
import { srsMap, getNextReview, repeatReview } from './quiz'

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
  nextReview?: Date | string
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

  qSearch = new QSearch({
    dialect: 'liteorm',
    schema: {
      deck: {},
      template: {},
      qfmt: {},
      afmt: {},
      front: {},
      back: {},
      source: {},
      data: {},
      mnemonic: {},
      srsLevel: { type: 'number' },
      nextReview: { type: 'date' },
      tag: {},
    },
  })

  constructor (filename: string) {
    this.db = new LiteOrm(filename)
    this.db.sql.run('PRAGMA journal_mode = WAL;')
  }

  async init () {
    return await this.db.init([dbSource, dbDeck, dbTemplate, dbNote, dbMedia, dbCard])
  }

  async find (cond: string | Record<string, any>, opts: {
    projection?: (keyof IEntry)[]
    offset?: number
    limit?: number
    sort?: {
      key: string
      desc: boolean
    }
  } = {}): Promise<UndefinedEqNull<Partial<IEntry>>[]> {
    const { projection, offset, limit, sort } = opts

    if (typeof cond === 'string') {
      cond = this.qSearch.parse(cond).cond
    }

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
    })(cond as Record<string, any>, (() => {
      const select = {
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
      }

      if (projection) {
        return Object.entries(select)
          .filter(([k]) => projection.includes(k as any))
          .reduce((prev, [k, v]) => ({ ...prev, [k]: v }), {})
      }

      return select
    })(), {
      sort,
      offset,
      limit,
    })
  }

  async update (
    ids: number[],
    set: (Partial<IEntry> | ((ent: DbCard) => Partial<DbCard> | Promise<Partial<DbCard>>)),
  ) {
    for (const idsChunk of chunk(ids, 900)) {
      if (typeof set === 'function') {
        await mapAsync(await this.db.all(dbCard)({ id: { $in: idsChunk } }, '*'), async (ent) => {
          ent = await set(ent as any)
          await this.db.update(dbCard)({ id: ent.id }, ent)
        })
      } else {
        await this.db.update(dbCard)({
          id: { $in: idsChunk },
        }, [
          Object.entries(set)
            .filter(([k]) => ['front', 'back', 'mnemonic', 'srsLevel', 'nextReview', 'tag'].includes(k))
            .map(([k, v]) => {
              return [k, (k === 'nextReview' && v) ? dayjs(v as string).toDate() : v]
            })
            .reduce((prev, [k, v]) => ({ ...prev, [k as string]: v }), {}),
        ])

        await mapAsync(await this.db.all(dbCard, dbDeck)({
          card__id: { $in: idsChunk },
        }, {
          id: dbCard.c.id,
          deck: dbDeck.c.name,
          templateId: dbTemplate.c.id,
          noteId: dbNote.c.id,
        }), async (ent) => {
          const setTemplate = ser.clone(Object.entries(set)
            .filter(([k]) => ['qfmt', 'afmt', 'css', 'js'].includes(k))
            .reduce((prev, [k, v]) => ({ ...prev, [k as string]: v }), {} as any))
          const setNote = ser.clone(Object.entries(set)
            .filter(([k]) => ['data', 'order'].includes(k))
            .reduce((prev, [k, v]) => ({ ...prev, [k as string]: v }), {} as any))

          if (set.deck && ent.deck !== set.deck) {
            let deckId: number

            try {
              deckId = (await this.db.first(dbDeck)({ name: set.deck }, {
                id: dbDeck.c.id,
                name: dbDeck.c.name,
              })).id!
            } catch (_) {
              deckId = await this.db.create(dbDeck)({ name: set.deck })
            }

            await this.db.update(dbCard)({ id: ent.id }, {
              deckId: dbCard.c.deckId,
            })
          }

          if (Object.keys(setTemplate).length > 0) {
            await this.db.update(dbTemplate)({ id: ent.templateId }, setTemplate)
          }

          if (Object.keys(setNote).length > 0) {
            try {
              if (setNote.data) {
                const { data } = await this.db.first(dbNote)({ id: ent.noteId }, {
                  data: dbNote.c.data,
                })
                Object.assign(setNote.data, data)
              }

              await this.db.update(dbNote)({ id: ent.noteId }, setNote)
            } catch (e) {
              console.error(e)
            }
          }
        })
      }
    }
  }

  async delete (ids: number[]) {
    for (const idsChunk of chunk(ids, 900)) {
      await this.db.delete(dbCard)({
        id: { $in: idsChunk },
      })
    }
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
          nextReview: ent.nextReview ? dayjs(ent.nextReview).toDate() : undefined,
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

  async export (cond: Record<string, any>) {
    const ds = await this.find(cond) as IEntry[]
    const tmpDir = path.join(tmpPath, nanoid())
    fs.ensureDirSync(path.join(tmpDir, 'media'))

    const mapIdToName: Record<string, string> = {}

    for (const atts of chunk(Array.from(new Set(ds
      .reduce((prev, c) => [...prev, ...(c.attachments || []) as number[]], [] as number[]))), 900)) {
      (await this.db.all(dbMedia)({
        id: { $in: atts },
      }, {
        id: dbMedia.c.id,
        name: dbMedia.c.name,
      })).map((el) => {
        mapIdToName[el.id!.toString()] = el.name
        fs.copyFileSync(path.join(mediaPath, el.name), path.join(tmpDir, 'media', el.name))
      })
    }

    ds.map((d) => {
      if (d.attachments) {
        d.attachments.map((att, i) => {
          d.attachments![i] = {
            path: mapIdToName[att.toString()],
          }
        })
      }
    })

    const dstDb = new Db(path.join(tmpDir, 'data.db'))
    await dstDb.init()
    await dstDb.insert(...ds)
    await dstDb.db.close()

    const zip = new AdmZip(path.join(tmpDir, 'data.zip'))
    zip.addLocalFile(path.join(tmpDir, 'data.db'))
    zip.addLocalFolder(path.join(tmpDir, 'media'))
    zip.writeZip()

    return {
      path: path.join(tmpDir, 'data.zip'),
    }
  }

  async render (id: number) {
    const r = await this.find({ id }, {
      projection: [
        'front', 'back', 'mnemonic',
        'qfmt', 'afmt', 'css', 'js',
        'data',
      ],
      limit: 1,
    })
    if (!r[0]) {
      throw new Error(`Card ${id} not found.`)
    }

    const card = r[0]
    const { front, back, qfmt, afmt, data } = card

    if (typeof front !== 'string') {
      card.front = ankiMustache(qfmt || '', data || {})
    }

    if (typeof back !== 'string') {
      card.back = ankiMustache(afmt || '', data || {})
    }

    return card
  }

  async markRight (id: number) {
    return this._updateSrsLevel(+1, id)
  }

  async markWrong (id: number) {
    return this._updateSrsLevel(-1, id)
  }

  async markRepeat (id: number) {
    return this._updateSrsLevel(0, id)
  }

  private async _updateSrsLevel (dSrsLevel: number, id: number) {
    const cs = await this.find({ id }, {
      projection: ['srsLevel', 'stat'],
      limit: 1,
    })
    if (!cs[0]) {
      throw new Error(`Card ${id} not found.`)
    }

    const card = cs[0]
    card.srsLevel = card.srsLevel || 0
    card.stat = card.stat || {
      streak: {
        right: 0,
        wrong: 0,
      },
    }
    card.stat.streak = card.stat.streak || {
      right: 0,
      wrong: 0,
    }

    if (dSrsLevel > 0) {
      card.stat.streak.right = (card.stat.streak.right || 0) + 1
    } else if (dSrsLevel < 0) {
      card.stat.streak.wrong = (card.stat.streak.wrong || 0) + 1
    }

    card.srsLevel += dSrsLevel

    if (card.srsLevel >= srsMap.length) {
      card.srsLevel = srsMap.length - 1
    }

    if (card.srsLevel < 0) {
      card.srsLevel = 0
    }

    if (dSrsLevel > 0) {
      card.nextReview = getNextReview(card.srsLevel)
    } else {
      card.nextReview = repeatReview()
    }

    const { srsLevel, stat, nextReview } = card

    await this.db.update(dbCard)({ id }, { srsLevel, stat, nextReview })
  }
}

export let db: Db

export async function initDatabase (filename: string) {
  db = new Db(filename)
  await db.init()
}
