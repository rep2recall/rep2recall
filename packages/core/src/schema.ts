import DataStore from 'nedb-promises'
import t from 'runtypes'

import { srsMap, getNextReview, repeatReview } from './quiz'
import { Matter } from './matter'
import { toDate, ser } from './utils'

export const dbDataSchema = t.Record({
  /**
   * Filename
   */
  _id: t.String.Or(t.Undefined),

  /**
   * Frontmatter
   */
  h: t.String.Or(t.Undefined),
  data: t.Dictionary(t.Unknown).Or(t.Undefined),
  tag: t.Array(t.String).Or(t.Undefined),
  references: t.Array(t.String).Or(t.Undefined),

  /**
   * Quiz
   */
  nextReview: t.Unknown.withConstraint<Date>((d) => d instanceof Date).Or(t.Undefined),
  srsLevel: t.Number.Or(t.Undefined),
  streak: t.Record({
    right: t.Number,
    wrong: t.Number,
  }).Or(t.Undefined),
})

export type IDbDataSchema = t.Static<typeof dbDataSchema>

class DbData {
  db: DataStore

  constructor (public filename: string) {
    this.db = DataStore.create({ filename })
  }

  async init () {
    await this.db.ensureIndex({ fieldName: 'h', unique: true, sparse: true })
  }

  async close () {
    // await this.db.()
  }

  async insert (...entries: (IDbDataSchema | string)[]) {
    entries.map((el, i) => {
      if (typeof el === 'string') {
        const matter = new Matter()
        const { header } = matter.parse(el)
        el = ser.clone({
          nextReview: header.date ? toDate(header.date) : undefined,
          ...header,
        })
        entries[i] = el
      }

      dbDataSchema.check(el)
    })

    return await this.db.insert(entries)
  }

  async set (cond: any, $set: Partial<IDbDataSchema> | string) {
    if (typeof $set === 'string') {
      const matter = new Matter()
      const { header } = matter.parse($set)
      $set = ser.clone({
        nextReview: header.date ? toDate(header.date) : undefined,
        ...header,
      })
    }

    t.Partial(dbDataSchema.fields).check($set)

    await this.db.update(cond, { $set })
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

    const card = c as Partial<IDbDataSchema>
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
      card.nextReview = getNextReview(card.srsLevel)
    } else {
      card.nextReview = repeatReview()
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
