import path from 'path'

import DataStore from 'nedb-promises'
import { String } from 'runtypes'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'
import dayjs from 'dayjs'
import QSearch from '@patarapolw/qsearch'
import Ajv from 'ajv'
import hbs from 'handlebars'

import { hash } from '../utils'
import { mediaPath, tmpPath } from '../config'
import { srsMap, getNextReview, repeatReview } from './quiz'

export interface IDbData {
  type?: string
  h?: string
  data?: Record<string, any>
  source?: string
  deck?: string
  markdown?: string
  name?: string
  url?: string
  references?: string[] // REFERENCES
  tag?: string[]
  srsLevel?: number
  nextReview?: string
  streak?: {
    right: number
    wrong: number
  }
}

class DbData {
  db: DataStore
  ajv = new Ajv()
  validator = this.ajv.compile({
    type: 'object',
    properties: {
      markdown: { type: 'string' },
      type: { type: 'string' },
      h: { type: 'string' },
      data: { type: 'object' },
      source: { type: 'string' },
      deck: { type: 'string' },
      name: { type: 'string' },
      url: { type: 'string' },
      references: { type: 'array', items: { type: 'string' } },
      tag: { type: 'array', items: { type: 'string' } },
      srsLevel: { type: 'integer' },
      nextReview: { type: 'string', format: 'date-time' },
      streak: {
        type: 'object',
        required: ['right', 'wrong'],
        properties: {
          right: { type: 'integer' },
          wrong: { type: 'integer' },
        },
      },
    },
  })

  qSearch = new QSearch({
    dialect: 'nedb',
    schema: {
      deck: {},
      template: {},
      front: {},
      back: {},
      source: {},
      data: {},
      mnemonic: {},
      srsLevel: { type: 'number' },
      nextReview: { type: 'date' },
      tag: {},
    },
    normalizeDates: (d) => dayjs(d).toISOString(),
  })

  constructor (public filename: string) {
    this.db = DataStore.create({ filename })
  }

  async init () {
    await this.db.ensureIndex({ fieldName: 'h', unique: true, sparse: true })
  }

  async close () {
    // await this.db.()
  }

  async insert (...entries: IDbData[]) {
    for (const el of entries) {
      if (!this.validator(el)) {
        console.error(this.validator.errors)

        return {
          error: this.validator.errors,
        }
      }
    }

    return await this.db.insert(entries)
  }

  async set (cond: any, $set: Partial<IDbData>) {
    if (!this.validator($set)) {
      console.error(this.validator.errors)

      return {
        error: this.validator.errors,
      }
    }

    await this.db.update(cond, { $set })
  }

  async uploadMedia (f: string | Buffer, opts: {
    filename?: string
    makeUnique?: boolean
    source?: string
  } = {}) {
    let { filename, makeUnique, source } = opts

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

    return await this.insert({
      type: 'media',
      name: filename,
      url: filename,
      h: hash(b),
      source,
    })
  }

  async export (cond: Record<string, any>) {
    const ds = await this.db.find(cond) as IDbData[]
    const tmpDir = path.join(tmpPath, Math.random().toString(36).substr(2))
    fs.ensureDirSync(path.join(tmpDir, 'media'));

    (await this.db.find({
      type: 'media',
      _id: {
        $in: Array.from(new Set(ds
          .reduce((prev, c) => [...prev, ...(c.references || [])], [] as string[]))),
      },
    })).map((el) => {
      const { url } = el as IDbData

      if (url && fs.existsSync(path.join(mediaPath, url))) {
        fs.copyFileSync(path.join(mediaPath, url), path.join(tmpDir, 'media', url))
      }
    })

    const dstDb = new DbData(path.join(tmpDir, 'data.nedb'))
    await dstDb.init()
    await dstDb.insert(...ds)
    await dstDb.close()

    const zip = new AdmZip(path.join(tmpDir, 'data.zip'))
    zip.addLocalFile(path.join(tmpDir, 'data.db'))
    zip.addLocalFolder(path.join(tmpDir, 'media'))
    zip.writeZip()

    return {
      path: path.join(tmpDir, 'data.zip'),
    }
  }

  async render (id: string): Promise<IDbData> {
    const r = await this.db.findOne({ _id: id })

    if (r) {
      let { markdown, references } = r as IDbData

      if (references) {
        const contexts = await this.db.find({ _id: { $in: references } })
        if (markdown) {
          contexts.map((ctx) => {
            markdown = hbs.compile(markdown)({
              [ctx._id]: ctx,
            })
          })
        }

        return {
          ...r,
          markdown,
        }
      }

      return r as IDbData
    }

    throw new Error(`Cannot find item _id: ${id}`)
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
    const c = await this.db.findOne({ _id: id }, {
      srsLevel: 1,
      streak: 1,
    })
    if (!c) {
      throw new Error(`Card ${id} not found.`)
    }

    const card = c as Partial<IDbData>
    card.srsLevel = card.srsLevel || 0
    card.streak = card.streak || {
      right: 0,
      wrong: 0,
    }

    if (dSrsLevel > 0) {
      card.streak.right = (card.streak.right || 0) + 1
    } else if (dSrsLevel < 0) {
      card.streak.wrong = (card.streak.wrong || 0) + 1
    }

    card.srsLevel += dSrsLevel

    if (card.srsLevel >= srsMap.length) {
      card.srsLevel = srsMap.length - 1
    }

    if (card.srsLevel < 0) {
      card.srsLevel = 0
    }

    if (dSrsLevel > 0) {
      card.nextReview = getNextReview(card.srsLevel).toISOString()
    } else {
      card.nextReview = repeatReview().toISOString()
    }

    const { srsLevel, streak, nextReview } = card

    await this.set({ _id: id }, { srsLevel, streak, nextReview })
  }
}

export let db: DbData

export async function initDatabase (filename: string) {
  db = new DbData(filename)
  await db.init()
}
