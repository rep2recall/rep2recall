import * as t from 'runtypes'
import mongoose from 'mongoose'
import { prop, getModelForClass, index, DocumentType, Ref } from '@typegoose/typegoose'
import dayjs from 'dayjs'
import QSearch from '@patarapolw/qsearch'
import shortid from 'shortid'
import dotProp from 'dot-prop'

import { srsMap, getNextReview, repeatReview } from './quiz'
import { mapAsync, ser } from '../utils'

class DbUser {
  @prop({ required: true, unique: true }) email!: string
}

export const DbUserModel = getModelForClass(DbUser, { schemaOptions: { collection: 'user', timestamps: true } })

class DbTag {
  @prop({ required: true, unique: true }) name!: string

  static async upsert (entry: {
    name: string
  }) {
    let item: DocumentType<DbTag> | null = null
    try {
      item = await DbTagModel.findOne(entry)
      if (!item) {
        item = await DbTagModel.create(entry)
      }
    } catch (_) {
      item = await DbTagModel.findOne(entry)
    }

    return item
  }
}

export const DbTagModel = getModelForClass(DbTag, { schemaOptions: { collection: 'tag', timestamps: true } })

@index({ userId: 1, key: 1 }, { unique: true })
class DbLesson {
  @prop({ required: true, ref: 'DbUser' }) userId!: Ref<DbUser>
  @prop({ required: true }) key!: string
  @prop({ required: true }) name!: string
  @prop({ default: '' }) description!: string

  static async upsert (entry: {
    userId: Ref<DbUser>
    key: string
    name?: string
    description?: string
  }) {
    const { userId, key } = entry

    let item: DocumentType<DbLesson> | null = null
    try {
      item = await DbLessonModel.findOne({ userId, key })
      if (!item) {
        // if (!entry.name) {
        //   throw new Error('Name is required.')
        // }
        item = await DbLessonModel.create(entry)
      }
    } catch (_) {
      item = await DbLessonModel.findOne({ userId, key })
    }

    return item
  }

  static async upsertAll (userId: any, allLessons: {
    [key: string]: {
      _id?: Ref<DbLesson>
      name?: string | null
      description?: string | null
      decks: {
        [name: string]: Ref<DbCard>[]
      }
    }
  }) {
    await mapAsync(Object.entries(allLessons), async ([key, ls]) => {
      const lesson = await DbLessonModel.upsert({
        userId,
        key,
        name: ls.name || undefined,
        description: ls.description || '',
      })
      allLessons[key]._id = lesson!._id
    })

    const lsPromises: Promise<any>[] = []

    Object.entries(allLessons).map(([key, ls]) => {
      Object.entries(ls.decks).map(([deck, ids]) => {
        lsPromises.push((async () => {
          const d = (await DbDeck.upsert({
            name: deck,
            lessonId: ls._id!,
          }))!

          d.cardIds.push(...ids)
          d.cardIds = Array.from(new Set(d.cardIds))
          await d.save()
        })())
      })
    })

    await Promise.all(lsPromises)
  }
}

export const DbLessonModel = getModelForClass(DbLesson, { schemaOptions: { collection: 'lesson', timestamps: true } })

class DbDeck {
  @prop({ required: true }) name!: string
  @prop({ default: () => [], index: true, ref: 'DbCard' }) cardIds!: Ref<DbCard>[]
  @prop({ required: true, ref: 'DbLesson' }) lessonId!: Ref<DbLesson>

  static async upsert (entry: {
    name: string
    lessonId: Ref<DbLesson>
  }) {
    let item: DocumentType<DbDeck> | null = null
    try {
      item = await DbDeckModel.findOne(entry)
      if (!item) {
        item = await DbDeckModel.create(entry)
      }
    } catch (_) {
      item = await DbDeckModel.findOne(entry)
    }

    return item
  }
}

export const DbDeckModel = getModelForClass(DbDeck, { schemaOptions: { collection: 'deck', timestamps: true } })

@index({ userId: 1, key: 1 }, { unique: true })
class DbCard {
  @prop({ required: true, index: true, ref: 'DbUser' }) userId!: Ref<DbUser>

  /**
   * Explicit fields
   */
  @prop({ index: true, ref: 'DbTag' }) tag?: Ref<DbTag>[] // TagId-reference

  /**
   * Frontmatter
   */
  @prop({ required: true }) key!: string
  @prop() data?: Record<string, any>
  @prop({ index: true }) ref?: string[] // SelfId-reference

  /**
   * Content
   */
  @prop() markdown?: string
}

export const DbCardModel = getModelForClass(DbCard, { schemaOptions: { collection: 'card', timestamps: true } })

class DbQuiz {
  @prop({ default: () => shortid.generate() }) _id!: string
  @prop({ required: true }) nextReview!: Date
  @prop({ required: true }) srsLevel!: number
  @prop({ default: () => ({}) }) stat!: {
    streak?: {
      right?: number
      wrong?: number
      maxRight?: number
      maxWrong?: number
    }
    lastRight?: Date
    lastWrong?: Date
  }

  @prop({ required: true }) cardId!: any
}

export const DbQuizModel = getModelForClass(DbQuiz, { schemaOptions: { collection: 'quiz', timestamps: true } })

const tNullUndefined = t.Null.Or(t.Undefined)

export const DbSchema = t.Record({
  overwrite: t.Boolean.Or(tNullUndefined),
  lesson: t.Array(t.Record({
    key: t.String,
    name: t.String.Or(tNullUndefined),
    description: t.String.Or(tNullUndefined),
    deck: t.String,
  })).Or(tNullUndefined),
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

  readonly cardSearch = new QSearch({
    dialect: 'mongodb',
    schema: {
      lesson: {},
      key: {},
      tag: {},
      nextReview: { type: 'date' },
      srsLevel: { type: 'number' },
      markdown: { isAny: false },
    },
  })

  readonly lessonSearch = new QSearch({
    dialect: 'mongodb',
    schema: {
      deck: {},
      key: {},
      tag: {},
      nextReview: { type: 'date' },
      srsLevel: { type: 'number' },
      markdown: { isAny: false },
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

  async aggregateCard (preConds: any[], postConds: any[]) {
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
        $lookup: {
          from: 'deck',
          localField: '_id',
          foreignField: 'cardIds',
          as: 'd',
        },
      },
      { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'lesson',
          let: { lessonId: '$d.lessonId', deck: '$d.name' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$lessonId'] } } },
            {
              $project: {
                _id: 0,
                key: 1,
                name: 1,
                description: 1,
                deck: '$$deck',
              },
            },
          ],
          as: 'ls',
        },
      },
      { $unwind: { path: '$ls', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id',
          lesson: { $push: '$ls' },
          root: {
            $first: {
              key: '$key',
              data: '$data',
              tag: '$t.name',
              ref: '$ref',
              markdown: '$markdown',
              nextReview: '$q.nextReview',
              srsLevel: '$q.srsLevel',
              stat: '$q.stat',
              createdAt: '$createdAt',
              updatedAt: '$updatedAt',
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                lesson: '$lesson',
              },
              '$root',
            ],
          },
        },
      },
      ...postConds,
    ])
  }

  async aggregateLesson (preConds: any[], postConds: any[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    return await DbLessonModel.aggregate([
      { $match: { userId: this.user._id } },
      ...preConds,
      {
        $lookup: {
          from: 'deck',
          localField: '_id',
          foreignField: 'lessonId',
          as: 'd',
        },
      },
      { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'card',
          localField: 'd.cardIds',
          foreignField: '_id',
          as: 'c',
        },
      },
      { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'quiz',
          localField: 'c._id',
          foreignField: 'cardId',
          as: 'q',
        },
      },
      { $unwind: { path: '$q', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'tag',
          localField: 'c.tag',
          foreignField: '_id',
          as: 't',
        },
      },
      {
        $project: {
          _id: '$c._id',
          key: '$c.key',
          data: '$c.data',
          ref: '$c.ref',
          markdown: '$c.markdown',
          tag: '$t.name',
          deck: '$d.name',
          nextReview: '$q.nextReview',
          srsLevel: '$q.srsLevel',
          stat: '$q.stat',
        },
      },
      ...postConds,
    ])
  }

  async create (...entries: IDbSchema[]) {
    const user = this.user

    if (!user) {
      throw new Error('Not logged in')
    }

    entries.map((el) => {
      DbSchema.check(el)
    })

    const allTags = entries
      .map((el) => el.tag)
      .filter((ts) => ts)
      .reduce((prev, c) => [...prev!, ...c!], [])!
      .reduce((prev, c) => ({ ...prev, [c]: null }), {} as Record<string, Ref<DbTag> | null>)

    await mapAsync(Object.keys(allTags), async (t) => {
      allTags[t] = (await DbTagModel.upsert({ name: t }))!._id
    })

    const ops = ser.clone(entries.filter((el) => el.overwrite && el.key).map((el) => {
      return {
        replaceOne: {
          filter: { userId: user._id, key: el.key! },
          replacement: {
            userId: user._id,
            key: el.key,
            data: el.data || undefined,
            tag: el.tag ? el.tag.map((t) => allTags[t]) : undefined,
            ref: el.ref || undefined,
            markdown: el.markdown || undefined,
          },
          upsert: true,
        },
      }
    }))

    const { upsertedIds } = await DbCardModel.bulkWrite(ops, { ordered: false })

    const items = await DbCardModel.insertMany(entries.filter((el) => !(el.overwrite && el.key)).map((el) => {
      const key = el.key || shortid.generate()
      el.key = key

      return {
        userId: user._id,
        key,
        data: el.data || undefined,
        tag: el.tag ? el.tag.map((t) => allTags[t]) : undefined,
        ref: el.ref || undefined,
        markdown: el.markdown || undefined,
      }
    }), { ordered: false })

    const r = await DbCardModel.find({
      _id: {
        $in: [
          ...items.map((el) => el._id),
          ...Object.values(upsertedIds || {})],
      },
    }).select({ key: 1 })
    const keyToId = r.reduce((prev, { _id, key }) => ({ ...prev, [key]: _id }), {} as any)
    const entries_ = entries as (IDbSchema & { _id: any })[]

    entries_.map((el) => {
      if (el.key) {
        el._id = keyToId[el.key]
      }
    })

    const allLessons: {
      [key: string]: {
        _id?: Ref<DbLesson>
        name?: string | null
        description?: string | null
        decks: {
          [name: string]: Ref<DbCard>[]
        }
      }
    } = {}

    entries_.filter((el) => el.key).map(({ _id, lesson }) => {
      if (lesson) {
        lesson.map(({ key, name, description, deck }) => {
          if (!allLessons[key]) {
            allLessons[key] = { name, description, decks: {} }
          }

          if (!allLessons[key].decks[deck]) {
            allLessons[key].decks[deck] = []
          }

          allLessons[key].decks[deck].push(_id)
        })
      }
    })

    await DbLessonModel.upsertAll(user._id, allLessons)

    await DbQuizModel.insertMany(entries_
      .map((el) => {
        const { nextReview, srsLevel, stat, _id } = el
        if (!(nextReview && typeof srsLevel === 'number' && stat)) {
          return null
        }

        return { nextReview: dayjs(nextReview).toDate(), srsLevel, stat, cardId: _id }
      })
      .filter((el) => el), { ordered: false })

    return entries.map((el) => el.key)
  }

  async delete (...keys: string[]) {
    const user = this.user

    if (!user) {
      throw new Error('Not logged in')
    }

    const ids = (await DbCardModel.find({ key: { $in: keys } })).map((c) => c._id)
    const lessonIds = (await DbLessonModel.find({ userId: user.id })).map((ls) => ls._id)

    await Promise.all([
      DbCardModel.deleteMany({ _id: { $in: ids } }),
      DbQuizModel.deleteMany({ cardId: { $in: ids } }),
      DbDeckModel.updateMany({ lessonId: { $in: lessonIds } }, {
        $pull: { cardIds: { $in: ids } },
      }),
    ])
  }

  async update (keys: string[], set: IDbSchema) {
    const user = this.user

    if (!user) {
      throw new Error('Not logged in')
    }

    const {
      tag,
      srsLevel, nextReview, stat,
      lesson,
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
        allTags[t] = (await DbTagModel.upsert({ name: t }))!._id
      });

      (card as any).tag = tag.map((t) => allTags[t])
    }

    if (lesson) {
      ids = ids || (await DbCardModel.find({ key: { $in: keys } })).map((c) => c._id)
      const allLessons: {
        [key: string]: {
          _id?: Ref<DbLesson>
          name?: string | null
          description?: string | null
          decks: {
            [name: string]: Ref<DbCard>[]
          }
        }
      } = {}

      lesson.map(({ key, name, description, deck }) => {
        if (!allLessons[key]) {
          allLessons[key] = { name, description, decks: {} }
        }

        if (!allLessons[key].decks[deck]) {
          allLessons[key].decks[deck] = []
        }

        allLessons[key].decks[deck].push(...ids!)
      })

      await DbLessonModel.upsertAll(user._id, allLessons)
    }

    if (Object.keys(card).length > 0) {
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
      const r = await this.aggregateCard([
        { $match: { key } },
      ], [
        {
          $project: {
            lesson: 1,
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

      const card = await DbCardModel.findOne({ userId: this.user._id, key }).select({ _id: 1 })

      if (!card) {
        throw new Error(`Card ${key} not found.`)
      }

      const quiz = await DbQuizModel.findOne({ cardId: card._id }).select({ stat: 1, srsLevel: 1 })

      let srsLevel = 0
      let stat = {}
      let nextReview = repeatReview()

      if (quiz) {
        srsLevel = quiz.srsLevel
        stat = quiz.stat
      }

      if (dSrsLevel > 0) {
        dotProp.set(stat, 'streak.right', dotProp.get(stat, 'streak.right', 0) + 1)
        dotProp.set(stat, 'streak.wrong', 0)
        dotProp.set(stat, 'lastRight', new Date())

        if (dotProp.get(stat, 'streak.right', 1) > dotProp.get(stat, 'streak.maxRight', 0)) {
          dotProp.set(stat, 'streak.maxRight', dotProp.get(stat, 'streak.right', 1))
        }
      } else if (dSrsLevel < 0) {
        dotProp.set(stat, 'streak.wrong', dotProp.get(stat, 'streak.wrong', 0) + 1)
        dotProp.set(stat, 'streak.right', 0)
        dotProp.set(stat, 'lastWrong', new Date())

        if (dotProp.get(stat, 'streak.wrong', 1) > dotProp.get(stat, 'streak.maxWrong', 0)) {
          dotProp.set(stat, 'streak.maxWrong', dotProp.get(stat, 'streak.wrong', 1))
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
        await DbQuizModel.create({
          srsLevel,
          stat,
          nextReview,
          cardId: card._id,
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

  async listLessons () {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    return await DbLessonModel.find({ userId: this.user._id }).select({ key: 1, name: 1, description: 1 })
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
