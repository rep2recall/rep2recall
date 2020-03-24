import { Entity, Db as LiteOrm, primary, prop, Table } from 'liteorm'

import { srsMap, getNextReview, repeatReview } from './quiz'
import { Matter } from './matter'

const x1fTransform = {
  get: (repr: string | null) => repr ? repr.split('\x1f').filter((el) => el) : null,
  set: (d: string[]) => d ? `\x1f${d.join('\x1f')}\x1f` : null,
}

@Entity({ name: 'data', timestamp: true })
class DbData {
  /**
   * Filename
   */
  @primary() id!: string

  /**
   * Frontmatter
   */
  @prop({ unique: true, null: true }) h?: string
  @prop({ default: () => ({}) }) data?: Record<string, any>
  @prop({ default: () => [], transform: x1fTransform }) tag?: string[]
  @prop({ default: () => [], transform: x1fTransform }) references?: string[]

  /**
   * Quiz
   */
  @prop() nextReview!: Date
  @prop({ type: 'int' }) srsLevel!: number
  @prop({
    default: () => ({
      right: 0,
      wrong: 0,
      maxRight: 0,
      maxWrong: 0,
    }),
  }) streak!: {
    right: number
    wrong: number
    maxRight: number
    maxWrong: number
  }
}

export const dbData = new Table(DbData)

class Db {
  db: LiteOrm

  constructor (public filename: string) {
    this.db = new LiteOrm(filename)
  }

  async init () {
    await this.db.init([dbData])
  }

  async close () {
    await this.db.close()
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  async get (id: string) {
    try {
      return await this.db.first(dbData)({ id }, {
        srsLevel: dbData.c.srsLevel,
        streak: dbData.c.streak,
        nextReview: dbData.c.nextReview,
      })
    } catch (_) {
      return null
    }
  }

  private _updateSrsLevel (dSrsLevel: number) {
    return async (id: string, newItem?: string) => {
      let card = await this.get(id)

      const isNew = !card

      if (!card) {
        card = {
          srsLevel: 0,
          streak: {
            right: 0,
            wrong: 0,
            maxRight: 0,
            maxWrong: 0,
          },
          nextReview: repeatReview(),
        }
      }

      if (dSrsLevel > 0) {
        card.streak.right = card.streak.right + 1
        card.streak.wrong = 0

        if (card.streak.right > card.streak.maxRight) {
          card.streak.maxRight = card.streak.right
        }
      } else if (dSrsLevel < 0) {
        card.streak.wrong = card.streak.wrong + 1
        card.streak.right = 0

        if (card.streak.wrong > card.streak.maxWrong) {
          card.streak.maxWrong = card.streak.wrong
        }
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

      if (newItem) {
        const matter = new Matter()
        const { header: { h, data, tag, references } } = matter.parse(newItem)
        const validHeader = { h, data, tag, references }

        if (isNew) {
          await this.db.create(dbData)({
            srsLevel,
            streak,
            nextReview,
            id,
            ...validHeader,
          })
        } else {
          await this.db.update(dbData)({ id }, {
            srsLevel,
            streak,
            nextReview,
            ...validHeader,
          })
        }
      } else {
        await this.db.update(dbData)({ id }, { srsLevel, streak, nextReview })
      }
    }
  }
}

export let db: Db

export async function initDatabase (filename: string) {
  db = new Db(filename)
  await db.init()
}
