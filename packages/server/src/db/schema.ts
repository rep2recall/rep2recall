import * as t from 'runtypes'
import mongoose from 'mongoose'
import { prop, getModelForClass, index, DocumentType, Ref } from '@typegoose/typegoose'
import dayjs from 'dayjs'
import shortid from 'shortid'
import dotProp from 'dot-prop'
import { nanoid } from 'nanoid'

import QSearch from '../qsearch'
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

class DbLesson {
  @prop({ default: () => nanoid() }) _id!: string
  @prop({ required: true }) name!: string
  @prop() description?: string
}

export const DbLessonModel = getModelForClass(DbLesson, { schemaOptions: { collection: 'lesson', timestamps: true } })

class DbDeck {
  @prop({ required: true }) name!: string
  @prop({ default: () => [], index: true, ref: 'DbCard' }) cardIds!: Ref<DbCard>[]
  @prop({ ref: 'DbLesson' }) lessonId?: string

  static async upsert (entry: {
    name: string
    lessonId: string
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
  @prop({ index: true }) ref?: string[] // SelfKey-reference

  /**
   * Content
   */
  @prop() markdown?: string

  static async stdLookup (opts: {
    preConds?: any[]
    postConds?: any[]
    project?: {
      quiz?: boolean
      tag?: boolean
      deck?: boolean
      lesson?: boolean
    }
  }) {
    if (!db) {
      throw new Error('Database is not initialized')
    }

    if (!db.user) {
      throw new Error('Not logged in')
    }

    if (opts.project && opts.project.lesson !== false) {
      opts.project.deck = true
    }

    return await DbCardModel.aggregate([
      { $match: { userId: db.user._id } },
      ...(opts.preConds || []),
      ...(!(opts.project && opts.project.quiz === false) ? [
        {
          $lookup: {
            from: 'quiz',
            localField: '_id',
            foreignField: 'cardId',
            as: 'q'
          }
        },
        { $unwind: { path: '$q', preserveNullAndEmptyArrays: true } }
      ] : []),
      ...(!(opts.project && opts.project.tag === false) ? [
        {
          $lookup: {
            from: 'tag',
            localField: 'tag',
            foreignField: '_id',
            as: 't'
          }
        },
        { $addFields: { tag: '$t.name' } }
      ] : []),
      ...(!(opts.project && opts.project.deck === false) ? [
        {
          $lookup: {
            from: 'deck',
            localField: '_id',
            foreignField: 'cardIds',
            as: 'd'
          }
        },
        { $unwind: { path: '$d', preserveNullAndEmptyArrays: true } }
      ] : []),
      ...(!(opts.project && opts.project.lesson === false) ? [
        {
          $lookup: {
            from: 'lesson',
            localField: 'd.lessonId',
            foreignField: '_id',
            as: 'ls'
          }
        },
        { $unwind: { path: '$ls', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$_id',
            userId: { $first: '$userId' },
            key: { $first: '$key' },
            data: { $first: '$data' },
            ref: { $first: '$ref' },
            markdown: { $first: '$markdown' },
            tag: { $first: '$tag' },
            nextReview: { $first: '$q.nextReview' },
            srsLevel: { $first: '$q.srsLevel' },
            stat: { $first: '$q.stat' },
            lesson: {
              $push: {
                key: { $ifNull: ['$ls._id', '_'] },
                name: { $ifNull: ['$ls.name', 'User'] },
                deck: '$d.name'
              }
            }
          }
        }
      ] : []),
      ...(opts.postConds || [])
    ])
  }
}

export const DbCardModel = getModelForClass(DbCard, { schemaOptions: { collection: 'card', timestamps: true } })

class DbQuiz {
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
  deck: t.String.Or(tNullUndefined),
  lesson: t.Array(t.Record({
    key: t.String,
    name: t.String.Or(tNullUndefined),
    description: t.String.Or(tNullUndefined),
    deck: t.String
  })).Or(tNullUndefined),
  key: t.String.Or(tNullUndefined),
  data: t.Unknown.Or(tNullUndefined),
  tag: t.Array(t.String).Or(tNullUndefined),
  ref: t.Array(t.String).Or(tNullUndefined),
  markdown: t.String.Or(tNullUndefined),
  nextReview: t.Unknown.withConstraint<Date>((d) => !d || d instanceof Date).Or(t.String).Or(tNullUndefined),
  srsLevel: t.Number.Or(tNullUndefined),
  stat: t.Unknown
})

export type IDbSchema = t.Static<typeof DbSchema>

class Db {
  user: DocumentType<DbUser> | null = null

  qSearch = new QSearch({
    dialect: 'mongodb',
    schema: {
      lesson: {},
      deck: {},
      key: {},
      tag: {},
      nextReview: { type: 'date' },
      srsLevel: { type: 'number' },
      data: { isAny: false },
      'stat.streak.right': { type: 'number' },
      'stat.streak.wrong': { type: 'number' },
      'stat.streak.maxRight': { type: 'number' },
      'stat.streak.maxWrong': { type: 'number' },
      'stat.lastRight': { type: 'date' },
      'stat.lastWrong': { type: 'date' }
    }
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
            markdown: el.markdown || undefined
          },
          upsert: true
        }
      }
    }))

    const { upsertedIds } = ops.length > 0 ? await DbCardModel.bulkWrite(ops, { ordered: false }) : {
      upsertedIds: {}
    }

    const items = await DbCardModel.insertMany(entries.filter((el) => !(el.overwrite && el.key)).map((el) => {
      const key = el.key || shortid.generate()
      el.key = key

      return {
        userId: user._id,
        key,
        data: el.data || undefined,
        tag: el.tag ? el.tag.map((t) => allTags[t]) : undefined,
        ref: el.ref || undefined,
        markdown: el.markdown || undefined
      }
    }), { ordered: false })

    const r = await DbCardModel.find({
      _id: {
        $in: [
          ...items.map((el) => el._id),
          ...Object.values(upsertedIds || {})]
      }
    }).select({ key: 1 })
    const keyToId = r.reduce((prev, { _id, key }) => ({ ...prev, [key]: _id }), {} as any)
    const entries_ = entries as (IDbSchema & { _id: any })[]

    entries_.map((el) => {
      if (el.key) {
        el._id = keyToId[el.key]
      }
    })

    await this.upsertLessonAndDeck(...entries_)

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

    await Promise.all([
      DbCardModel.deleteMany({ _id: { $in: ids } }),
      DbQuizModel.deleteMany({ cardId: { $in: ids } }),
      DbDeckModel.updateMany({}, {
        $pull: { cardIds: { $in: ids } }
      })
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
      lesson, deck,
      ...card
    } = set

    let ids: any[] | null = null

    if (typeof srsLevel === 'number' || nextReview || stat) {
      ids = (await DbCardModel.find({ key: { $in: keys } })).map((c) => c._id)

      await DbQuizModel.updateMany({ cardId: { $in: ids } }, {
        $set: ser.clone({
          srsLevel,
          stat,
          nextReview: nextReview ? dayjs(nextReview).toDate() : undefined
        })
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

    if (lesson || deck) {
      ids = ids || (await DbCardModel.find({ key: { $in: keys } })).map((c) => c._id)
      await this.upsertLessonAndDeck(...ids.map((_id) => ({ _id, ...set })))
    }

    if (Object.keys(card).length > 0) {
      await DbCardModel.updateMany({ key: { $in: keys } }, {
        $set: card
      })
    }
  }

  async addTags (keys: string[], tags: string[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    await DbCardModel.updateMany({ key: { $in: keys } }, {
      $addToSet: { tag: { $each: tags } }
    })
  }

  async removeTags (keys: string[], tags: string[]) {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    await DbCardModel.updateMany({ key: { $in: keys } }, {
      $pull: { tag: { $in: tags } }
    })
  }

  async render (key: string, opts: {
    min: boolean
  }): Promise<any> {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    if (opts.min) {
      const r = await DbCardModel.aggregate([
        { $match: { userId: this.user._id, key } },
        {
          $project: {
            data: 1,
            ref: 1,
            markdown: 1
          }
        }
      ])

      return r[0] || null
    } else {
      const r = (await DbCardModel.stdLookup({
        preConds: [
          { $match: { key } }
        ]
      }))[0]

      if (!r) {
        return null
      }

      r.deck = r.lesson.filter((ls: any) => !ls.key).map((ls: any) => ls.deck)[0]
      r.lesson = r.lesson.filter((ls: any) => ls.key)

      return r
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
          cardId: card._id
        })
      } else {
        await DbQuizModel.findByIdAndUpdate(quiz._id, {
          $set: {
            srsLevel,
            stat,
            nextReview
          }
        })
      }
    }
  }

  async listLessons () {
    if (!this.user) {
      throw new Error('Not logged in')
    }

    const r = await DbCardModel.stdLookup({
      project: {
        quiz: false,
        tag: false
      },
      postConds: [
        {
          $project: {
            'lesson.key': 1,
            _id: 0
          }
        }
      ]
    })

    return await DbLessonModel.aggregate([
      {
        $match: {
          _id: {
            $in: Array.from<any>(new Set(
              r.map((el) => el.lesson || []).reduce((prev, arr: any[]) => [...prev, ...arr.map((a) => a.key)], [])
            ))
          }
        }
      },
      {
        $project: {
          key: '$_id',
          name: 1,
          description: 1,
          _id: 0
        }
      }
    ])
  }

  async upsertLessonAndDeck (...items: {
    _id: any
    lesson?: {
      key: string
      name?: string | null
      description?: string | null
      deck: string
    }[] | null
    deck?: string | null
  }[]) {
    const lsCreationMap = new Map<string, any>()

    items.map(({ lesson }) => {
      if (lesson) {
        lesson.map(({ key, name, description }) => {
          if (name && !lsCreationMap.has(key)) {
            lsCreationMap.set(key, { name, description: description || undefined })
          }
        })
      }
    })

    await mapAsync(Array.from(lsCreationMap), async ([key, { name, description }]) => {
      await DbLessonModel.findByIdAndUpdate(key, {
        $set: { name, description },
        $setOnInsert: { _id: key }
      }, { upsert: true })
    })

    const lsDeckMap = new Map<string, any[]>()

    items.map(({ _id, lesson }) => {
      if (lesson) {
        lesson.map(({ key, deck, name, description }) => {
          const h = JSON.stringify([key, deck, name || '', description || ''])
          const cardIds = lsDeckMap.get(h) || []
          cardIds.push(_id)
          lsDeckMap.set(h, cardIds)
        })
      }
    })

    await mapAsync(Array.from(lsDeckMap), async ([h, cardIds]) => {
      const [lessonId, deck] = JSON.parse(h)
      await DbDeckModel.findOneAndUpdate({ name: deck, lessonId }, {
        $addToSet: { cardIds: { $each: cardIds } },
        $setOnInsert: { name: deck, lessonId }
      }, { upsert: true })
    })

    const deckMap = new Map<string, any[]>()

    items.map(({ _id, deck }) => {
      if (deck) {
        const cardIds = deckMap.get(deck) || []
        cardIds.push(_id)
        deckMap.set(deck, cardIds)
      }
    })

    await mapAsync(Array.from(deckMap), async ([name, cardIds]) => {
      await DbDeckModel.findOneAndUpdate({ name }, {
        $addToSet: { cardIds: { $each: cardIds } },
        $setOnInsert: { name }
      }, { upsert: true })
    })
  }
}

export let db: Db

export async function initDatabase (mongoUri: string) {
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
  })

  db = new Db()
}
