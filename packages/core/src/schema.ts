import DataStore from 'nedb-promises'
import t from 'runtypes'

import { srsMap, getNextReview, repeatReview } from './quiz'
import { Matter } from './matter'
import { toDate, ser } from './utils'

export const dbDataSchema = t.Record({
  /**
   * Filename
   */
  _id: t.String,

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
  nextReview: t.Unknown.withConstraint<Date>((d) => d instanceof Date),
  srsLevel: t.Number,
  streak: t.Record({
    right: t.Number,
    wrong: t.Number,
  }),
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

  async insert (...entries: IDbDataSchema[]) {
    entries.map((el) => {
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

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  private _updateSrsLevel (dSrsLevel: number) {
    return async (id: string, newItem?: string) => {
      let card = {
        srsLevel: 0,
        streak: {
          right: 0,
          wrong: 0,
        },
        nextReview: repeatReview(),
      }

      if (!newItem) {
        card = await this.db.findOne({ _id: id }, {
          srsLevel: 1,
          streak: 1,
          nextReview: 1,
        }) as any
        if (!card) {
          throw new Error(`Card ${id} not found.`)
        }
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
      }

      const { srsLevel, streak, nextReview } = card

      if (newItem) {
        const matter = new Matter()
        const { header } = matter.parse(newItem)

        await this.insert(ser.clone({
          srsLevel,
          streak,
          nextReview,
          _id: id,
          ...header,
        }))
      } else {
        await this.set({ _id: id }, { srsLevel, streak, nextReview })
      }
    }
  }
}

export let db: DbData

export async function initDatabase (filename: string) {
  db = new DbData(filename)
  await db.init()
}
