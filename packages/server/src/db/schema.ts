import * as t from 'runtypes'
import mongoose from 'mongoose'
import { prop, getModelForClass, index, DocumentType, Ref } from '@typegoose/typegoose'
import nanoid from 'nanoid'
import dayjs from 'dayjs'
import QSearch from '@patarapolw/qsearch'

import { srsMap, getNextReview, repeatReview } from './quiz'
import { mapAsync, ser } from '../utils'

class DbUser {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) email!: string
}

export const DbUserModel = getModelForClass(DbUser, { schemaOptions: { collection: 'user', timestamps: true } })

class DbTag {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) name!: string
}

export const DbTagModel = getModelForClass(DbTag, { schemaOptions: { collection: 'tag', timestamps: true } })

@index({ key: 1, userId: 1 }, { unique: true, sparse: true })
class DbCard {
  @prop({ required: true }) userId!: string

  /**
   * Explicit fields
   */
  @prop() deck?: string
  @prop() tag?: string[] // TagId-reference

  /**
   * Frontmatter
   */
  @prop({ default: () => nanoid() }) key?: string
  @prop() data?: Record<string, any>
  @prop() ref?: string[] // SelfId-reference

  /**
   * Content
   */
  @prop() markdown?: string

  /**
   * Quiz
   */
  // @prop({ ref: 'DbQuiz' }) quizId?: string
}

export const DbCardModel = getModelForClass(DbCard, { schemaOptions: { collection: 'card', timestamps: true } })

class DbQuiz {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) nextReview!: Date
  @prop({ required: true }) srsLevel!: number
  @prop() stat?: {
    streak: {
      right: number
      wrong: number
      maxRight: number
      maxWrong: number
    }
  }

  @prop({ required: true, ref: 'DbCard' }) cardId!: Ref<DbCard>
}

export const DbQuizModel = getModelForClass(DbQuiz, { schemaOptions: { collection: 'quiz', timestamps: true } })

const tNullUndefined = t.Null.Or(t.Undefined)

export const DbSchema = t.Record({
  deck: t.String.Or(tNullUndefined),
  key: t.String.Or(tNullUndefined),
  data: t.Unknown.Or(tNullUndefined),
  tag: t.Array(t.String).Or(tNullUndefined),
  ref: t.Array(t.String).Or(tNullUndefined),
  markdown: t.String.Or(tNullUndefined),
  nextReview: t.Unknown.withConstraint<Date>((d) => !d || d instanceof Date).Or(t.String).Or(tNullUndefined),
  srsLevel: t.Number.Or(tNullUndefined),
  stat: t.Unknown,
})

export type IDbSchema = t.Static<typeof DbSchema>

class Db {
  user: DocumentType<DbUser> | null = null

  readonly qSearch = new QSearch({
    dialect: 'mongodb',
    schema: {
      deck: {},
      key: {},
      tag: {},
      nextReview: { type: 'date' },
      srsLevel: { type: 'number' },
    },
  })

  async signIn (email: string) {
    this.user = await DbUserModel.findOne({ email })
    if (!this.user) {
      this.user = await DbUserModel.create({ email })
    }

    return this.user
  }

  async signOut () {
    this.user = null
  }

  async close () {
    await mongoose.disconnect()
  }

  async aggregate (preConds: any[], postConds: any[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    return await DbCardModel.aggregate([
      { $match: { userId: this.user._id } },
      ...preConds,
      {
        $lookup: {
          from: 'quiz',
          localField: '_id',
          foreignField: 'cardId',
          as: 'q',
        },
      },
      { $unwind: { path: '$q', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'tag',
          localField: 'tag',
          foreignField: '_id',
          as: 't',
        },
      },
      {
        $project: {
          deck: 1,
          key: 1,
          data: 1,
          tag: '$t.name',
          ref: 1,
          markdown: 1,
          nextReview: '$q.nextReview',
          srsLevel: '$q.srsLevel',
          stat: '$q.stat',
        },
      },
      ...postConds,
    ])
  }

  async create (...entries: IDbSchema[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    entries.map((el) => {
      DbSchema.check(el)
    })

    const allTags = entries
      .map((el) => el.tag)
      .filter((ts) => ts)
      .reduce((prev, c) => [...prev!, ...c!], [])!
      .reduce((prev, c) => ({ ...prev, [c]: null }), {} as Record<string, string | null>)

    await mapAsync(Object.keys(allTags), async (t) => {
      const el = await DbTagModel.findOneAndUpdate({ name: t }, { $set: { name: t } }, {
        upsert: true, new: true, setDefaultsOnInsert: true,
      })
      allTags[t] = el._id
    })

    const items = await DbCardModel.insertMany(ser.clone(entries.map((el) => ({
      userId: this.user!._id,
      deck: el.deck || undefined,
      key: el.key || undefined,
      data: el.data || undefined,
      tag: el.tag ? el.tag.map((t) => allTags[t]) : undefined,
      ref: el.ref || undefined,
      markdown: el.markdown || undefined,
    }))))

    await DbQuizModel.insertMany(entries
      .map((el, i) => {
        const { nextReview, srsLevel, stat } = el
        if (!(nextReview && typeof srsLevel === 'number' && stat)) {
          return null
        }

        return { nextReview: dayjs(nextReview).toDate(), srsLevel, stat, cardId: items[i]._id }
      })
      .filter((el) => el))

    return items
  }

  async delete (...keys: string[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    const ids = (await DbCardModel.find({ key: { $in: keys } })).map((c) => c._id)

    await Promise.all([
      DbCardModel.deleteMany({ _id: { $in: ids } }),
      DbQuizModel.deleteMany({ cardId: { $in: ids } }),
    ])
  }

  async update (keys: string[], set: IDbSchema) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    const {
      tag,
      srsLevel, nextReview, stat,
      ...card
    } = set

    let ids: any[] | null = null

    if (typeof srsLevel === 'number' || nextReview || stat) {
      ids = (await DbCardModel.find({ key: { $in: keys } })).map((c) => c._id)

      await DbQuizModel.updateMany({ cardId: { $in: ids } }, {
        $set: ser.clone({
          srsLevel,
          stat,
          nextReview: nextReview ? dayjs(nextReview).toDate() : undefined,
        }),
      })
    }

    if (tag) {
      ids = ids || (await DbCardModel.find({ key: { $in: keys } })).map((c) => c._id)

      const allTags = tag
        .reduce((prev, c) => ({ ...prev, [c]: null }), {} as Record<string, string | null>)

      await mapAsync(Object.keys(allTags), async (t) => {
        const el = await DbTagModel.findOneAndUpdate({ name: t }, { $set: { name: t } }, {
          upsert: true, new: true, setDefaultsOnInsert: true,
        })
        allTags[t] = el._id
      })

      await DbCardModel.updateMany({ _id: { $in: ids } }, {
        $set: {
          ...card,
          tag: tag.map((t) => allTags[t]),
        },
      })
    } else {
      await DbCardModel.updateMany({ key: { $in: keys } }, {
        $set: card,
      })
    }
  }

  async addTags (keys: string[], tags: string[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    await DbCardModel.updateMany({ key: { $in: keys } }, {
      $addToSet: { tag: { $each: tags } },
    })
  }

  async removeTags (keys: string[], tags: string[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    await DbCardModel.updateMany({ key: { $in: keys } }, {
      $pull: { tag: { $in: tags } },
    })
  }

  async render (key: string, minify: boolean = false): Promise<any> {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    if (minify) {
      const r = await DbCardModel.aggregate([
        { $match: { userId: this.user._id, key } },
        {
          $project: {
            data: 1,
            ref: 1,
            markdown: 1,
          },
        },
      ])

      return r[0] || null
    } else {
      const r = await this.aggregate([
        { $match: { key } },
      ], [
        {
          $project: {
            deck: 1,
            key: 1,
            data: 1,
            tag: 1,
            ref: 1,
            markdown: 1,
            nextReview: 1,
            srsLevel: 1,
            stat: 1,
          },
        },
      ])

      if (!r) {
        return null
      }

      return r[0] || null
    }
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  private _updateSrsLevel (dSrsLevel: number) {
    return async (key: string) => {
      if (!this.user) {
        throw new Error('Not logged in')
      }

      const card = await DbCardModel.findOne({ key }).select({ quizId: 1 })

      if (!card) {
        throw new Error(`Card ${key} not found.`)
      }

      const quiz = await DbQuizModel.findOne({ cardId: card._id }).select({ stat: 1, srsLevel: 1 })

      let srsLevel = 0
      let stat = {
        streak: {
          right: 0,
          wrong: 0,
          maxRight: 0,
          maxWrong: 0,
        },
      }
      let nextReview = repeatReview()

      if (quiz) {
        srsLevel = quiz.srsLevel
        if (quiz.stat) {
          stat = quiz.stat
        }
      }

      if (dSrsLevel > 0) {
        stat.streak.right = stat.streak.right + 1
        stat.streak.wrong = 0

        if (stat.streak.right > stat.streak.maxRight) {
          stat.streak.maxRight = stat.streak.right
        }
      } else if (dSrsLevel < 0) {
        stat.streak.wrong = stat.streak.wrong + 1
        stat.streak.right = 0

        if (stat.streak.wrong > stat.streak.maxWrong) {
          stat.streak.maxWrong = stat.streak.wrong
        }
      }

      srsLevel += dSrsLevel

      if (srsLevel >= srsMap.length) {
        srsLevel = srsMap.length - 1
      }

      if (srsLevel < 0) {
        srsLevel = 0
      }

      if (dSrsLevel > 0) {
        nextReview = getNextReview(srsLevel)
      }

      if (!quiz) {
        const item = await DbQuizModel.create({
          srsLevel,
          stat,
          nextReview,
        })
        await DbCardModel.updateOne({ key }, {
          $set: {
            quizId: item._id,
          },
        })
      } else {
        await DbQuizModel.findByIdAndUpdate(quiz._id, {
          $set: {
            srsLevel,
            stat,
            nextReview,
          },
        })
      }
    }
  }
}

export let db: Db

export async function initDatabase (mongoUri: string) {
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })

  db = new Db()
}
