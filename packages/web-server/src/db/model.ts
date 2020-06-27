import crypto from 'crypto'

import { prop, getModelForClass, index, setGlobalOptions, Severity, DocumentType, mongoose } from '@typegoose/typegoose'
import { nanoid } from 'nanoid'
import shortid from 'shortid'
import { Serialize } from 'any-serialize'

import { repeatReview, srsMap, getNextReview } from './quiz'
import QSearch from './search'
import { IDeck, IQuizStatistics, IEntry, zEntry } from './schema'

export const ser = new Serialize()
export const qSearch = new QSearch({
  dialect: 'mongodb',
  schema: {
    key: { isAny: false },
    tag: {},
    // data: { type: 'object' },
    'deck.name': {},
    'deck.lesson': {},
    'quiz.nextReview': { type: 'date' },
    'quiz.lastRight': { type: 'date' },
    'quiz.lastWrong': { type: 'date' },
    'quiz.srsLevel': { type: 'number' },
    'quiz.streak.right': { type: 'number' },
    'quiz.streak.wrong': { type: 'number' },
    'quiz.streak.lastRight': { type: 'number' },
    'quiz.streak.lastWrong': { type: 'number' }
  }
})

setGlobalOptions({ options: { allowMixed: Severity.ALLOW } })

class DbUser {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true, unique: true }) email!: string
  @prop({ default: () => DbUserModel.newSecret() }) secret?: string

  static newSecret () {
    return crypto.randomBytes(64).toString('base64')
  }

  static async signInOrCreate (email: string) {
    let user = await DbUserModel.findOne({ email })
    if (!user) {
      user = await DbUserModel.create({ email, secret: DbUserModel.newSecret() })
    }
    return user
  }

  static async signInWithSecret (email: string, secret: string) {
    const u = await DbUserModel.findOne({ email, secret })
    return u
  }
}

export const DbUserModel = getModelForClass(DbUser, { schemaOptions: { collection: 'user', timestamps: true } })

@index({ userId: 1, key: 1 }, { unique: true })
@index({ 'deck.id': 1 })
@index({ 'deck.name': 1 })
@index({ 'deck.lesson': 1 })
@index({ 'deck.lessonId': 1 })
@index({ 'quiz.nextReview': 1 })
@index({ 'quiz.srsLevel': 1 })
@index({ 'quiz.right': 1 })
@index({ 'quiz.wrong': 1 })
@index({ 'quiz.maxRight': 1 })
@index({ 'quiz.maxWrong': 1 })
class DbCard {
  @prop({ required: true, ref: 'DbUser' }) userId!: string

  /**
   * Frontmatter
   */
  @prop({ default: () => shortid.generate() }) key?: string
  @prop() data?: Record<string, any>
  @prop({ index: true }) ref?: string[] // SelfKey-reference
  @prop({ index: true }) tag?: string[]

  @prop({ required: true }) deck!: IDeck & {
    id: string
  }

  @prop(() => {
    const s: IQuizStatistics = {
      nextReview: new Date(),
      srsLevel: 0,
      streak: {
        right: 0,
        wrong: 0,
        maxRight: 0,
        maxWrong: 0
      }
    }

    return s
  }) quiz?: IQuizStatistics

  /**
   * Content
   */
  @prop() markdown?: string

  static async uInsert (userId: string, entries: IEntry[]) {
    entries = entries.map((el) => zEntry.parse(el))

    const deckMap = new Map<string, {
      id: string
      name: string
      lesson?: string
    } | undefined>()

    await Promise.all(entries.filter((el) => el.deck && el.deck.id).map(async (el) => {
      deckMap.set(el.deck!.id!, await DbDeckModel.uGetInfo(userId, el.deck!.id!))
    }))

    const ops = entries.map((el) => {
      const { key, data, tag, ref, markdown, quiz, deck } = el

      if (el.key) {
        return {
          replaceOne: {
            filter: { userId, key },
            replacement: {
              userId,
              key,
              data,
              tag,
              ref,
              markdown,
              quiz,
              deck: (deck && deck.id) ? deckMap.get(deck.id) : undefined
            },
            upsert: true
          }
        }
      } else {
        return {
          insertOne: {
            document: {
              userId,
              data,
              tag,
              ref,
              markdown,
              quiz,
              deck: (deck && deck.id) ? deckMap.get(deck.id) : undefined
            }
          }
        }
      }
    })

    const r = await DbCardModel.bulkWrite(ops, { ordered: false })
    const allIds = Object.assign(r.insertedIds || {}, r.upsertedIds || {})

    return (await DbCardModel.find({
      _id: { $in: entries.map((_, i) => allIds[i.toString()]).filter((el) => el) }
    }).select({ key: 1, _id: 0 })).map((el) => el.key!)
  }

  static async uUpdate (userId: string, keys: string[], update: Partial<IEntry>) {
    update = zEntry.partial().parse(update)

    const { deck, ...nonDeck } = update
    let lesson: string | undefined

    if (deck) {
      if (deck.id) {
        const r = await DbDeckModel.uGetInfo(userId, deck.id)
        if (r) {
          lesson = r.lesson
        }
      } else if (deck.name) {
        if (!deck.lessonId) {
          if (deck.lesson) {
            const r1 = await DbLessonModel.findOne({ userId, name: deck.lesson })
            if (r1) {
              deck.lessonId = r1._id
            }
          }
        }

        const r2 = await DbDeckModel.uUpsert(userId, {
          name: deck.name,
          lessonId: deck.lessonId
        })

        deck.id = r2.id
      }
    }

    await DbCardModel.updateMany({
      userId,
      key: { $in: keys }
    }, {
      $set: ser.clone({
        ...nonDeck,
        deck: (deck && deck.id) ? {
          id: deck.id,
          name: deck.name,
          lesson
        } : undefined
      })
    })
  }

  static async uAddTag (userId: string, keys: string[], tag: string[]) {
    await DbCardModel.updateMany({
      userId,
      key: { $in: keys }
    }, {
      $addToSet: { tag: { $each: tag } }
    })
  }

  static async uRemoveTag (userId: string, keys: string[], tag: string[]) {
    await DbCardModel.updateMany({
      userId,
      key: { $in: keys }
    }, {
      $pull: { tag: { $in: tag } }
    })
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  private _updateSrsLevel (dSrsLevel: number) {
    return () => {
      this.quiz = this.quiz || {
        nextReview: repeatReview(),
        srsLevel: 0,
        streak: {
          right: 0,
          wrong: 0,
          maxRight: 0,
          maxWrong: 0
        }
      }

      if (dSrsLevel > 0) {
        this.quiz.streak.right++
        this.quiz.streak.wrong = 0
        this.quiz.lastRight = new Date()

        if (this.quiz.streak.right > this.quiz.streak.maxRight) {
          this.quiz.streak.maxRight = this.quiz.streak.right
        }
      } else if (dSrsLevel < 0) {
        this.quiz.streak.wrong++
        this.quiz.streak.right = 0
        this.quiz.lastWrong = new Date()

        if (this.quiz.streak.wrong > this.quiz.streak.maxWrong) {
          this.quiz.streak.maxWrong = this.quiz.streak.wrong
        }
      }

      this.quiz.srsLevel++

      if (this.quiz.srsLevel >= srsMap.length) {
        this.quiz.srsLevel = srsMap.length - 1
      }

      if (this.quiz.srsLevel < 0) {
        this.quiz.srsLevel = 0
      }

      if (dSrsLevel > 0) {
        this.quiz.nextReview = getNextReview(this.quiz.srsLevel)
      }
    }
  }
}

export const DbCardModel = getModelForClass(DbCard, { schemaOptions: { collection: 'card', timestamps: true } })

@index({ userId: 1, name: 1, lessonId: 1 }, { unique: true })
class DbDeck {
  @prop({ required: true, ref: 'DbUser' }) userId!: string

  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) name!: string
  @prop() lessonId?: string

  static async uUpsert (userId: string, entry: {
    name: string
    lessonId?: string
  }) {
    const { name, lessonId } = entry

    let item: DocumentType<DbDeck> | null = null
    try {
      item = await DbDeckModel.findOne({ userId, name, lessonId })
      if (!item) {
        item = await DbDeckModel.create({ userId, name, lessonId })
      }
    } catch (_) {
      item = await DbDeckModel.findOne({ userId, name, lessonId })
    }

    return item!
  }

  static async uGetInfo (userId: string, id: string) {
    const r = await DbDeckModel.aggregate([
      { $match: { userId, _id: id } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'lesson',
          localField: 'lessonId',
          foreignField: '_id',
          as: 'ls'
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          lesson: { $arrayElemAt: ['$ls.name', 0] },
          lessonId: { $arrayElemAt: ['$ls._id', 0] }
        }
      }
    ])

    return r[0] as {
      id: string
      name: string
      lesson?: string
      lessonId?: string
    } | undefined
  }
}

export const DbDeckModel = getModelForClass(DbDeck, { schemaOptions: { collection: 'deck', timestamps: true } })

@index({ userId: 1, name: 1 }, { unique: true })
class DbLesson {
  @prop({ required: true, ref: 'DbUser' }) userId!: string

  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) name!: string
  @prop() description?: string
}

export const DbLessonModel = getModelForClass(DbLesson, { schemaOptions: { collection: 'lesson', timestamps: true } })

export async function initDatabase (mongoUri: string) {
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
  })
}
