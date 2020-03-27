import { Readable } from 'stream'

import t from 'runtypes'
import mongoose from 'mongoose'
import hbs from 'handlebars'
import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose'
import { GridFSBucket } from 'mongodb'
import nanoid from 'nanoid'

import { srsMap, getNextReview, repeatReview } from './quiz'

class DbUser {
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) email!: string
}

export const DbUserModel = getModelForClass(DbUser)

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
}

export const DbQuizModel = getModelForClass(DbQuiz)

@index({ h: 1, userId: 1 }, { unique: true })
class DbCard {
  /**
   * Filename and deck
   */
  @prop({ default: () => nanoid() }) _id?: string
  @prop({ required: true }) userId!: string
  @prop() deck?: string

  /**
   * Frontmatter
   */
  @prop({ unique: true }) h?: string
  @prop() data?: Record<string, any>
  @prop() tag?: string[]
  @prop() ref?: string[] // Self-reference
  @prop() media?: string[] // GridFS-reference

  /**
   * Content
   */
  @prop() markdown?: string

  /**
   * Quiz
   */
  @prop({ ref: 'DbQuiz' }) quizId?: string
}

export const DbCardModel = getModelForClass(DbCard)

export const getDbMediaBucket = () => new GridFSBucket(mongoose.connection.db)

const tNullUndefined = t.Null.Or(t.Undefined)

export const DbSchema = t.Record({
  quiz: t.Array(t.Record({
    _id: t.String,
    nextReview: t.Unknown.withConstraint<Date>((el) => el instanceof Date),
    srsLevel: t.Number,
    stat: t.Unknown,
  })),
  card: t.Array(t.Record({
    _id: t.String,
    deck: t.String.Or(tNullUndefined),
    h: t.String.Or(tNullUndefined),
    data: t.Unknown.Or(tNullUndefined),
    tag: t.Array(t.String).Or(tNullUndefined),
    ref: t.Array(t.String).Or(tNullUndefined),
    media: t.Array(t.String).Or(tNullUndefined),
    markdown: t.String.Or(tNullUndefined),
    quizId: t.String.Or(tNullUndefined),
  })),
  media: t.Array(t.Record({
    filename: t.String,
    data: t.Unknown,
    meta: t.Unknown.Or(tNullUndefined),
  })),
})

export type IDbSchema = t.Static<typeof DbSchema>

class Db {
  mediaBucket = getDbMediaBucket()
  user: DocumentType<DbUser> | null = null

  async signIn (email: string) {
    this.user = await DbUserModel.findOne({ email })
    if (this.user) {
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

  async insert (entry: IDbSchema) {
    if (!this.user) {
      return null
    }

    DbSchema.check(entry)

    const [cs] = await Promise.all([
      DbCardModel.insertMany(entry.card.map((c) => ({
        ...c,
        userId: this.user!._id,
      })), { ordered: false }),
      DbQuizModel.insertMany(entry.quiz, { ordered: false }),
      Promise.allSettled(entry.media.map((media) => {
        return this.uploadMedia(media as any)
      })),
    ])

    return cs.map((c) => c._id)
  }

  async uploadMedia (media: {
    data: Buffer
    filename: string
    meta?: any
  }) {
    if (!this.user) {
      return null
    }

    return new Promise((resolve, reject) => {
      new Readable({
        read () {
          this.push(media.data)
        },
      })
        .pipe(this.mediaBucket.openUploadStream(media.filename, {
          metadata: {
            ...(media.meta || {}),
            userId: this.user!._id,
          },
        }))
        .once('error', reject)
        .once('finish', resolve)
    })
  }

  async render (slug: string): Promise<any> {
    if (!this.user) {
      return null
    }

    const r = await DbCardModel.findById(slug)

    if (r) {
      let { markdown, ref } = r

      if (ref && markdown) {
        const contexts = await DbCardModel.find({ _id: { $in: ref } })
        contexts.map((ctx) => {
          markdown = hbs.compile(markdown)({
            [ctx._id]: ctx,
          })
        })

        return {
          ...r,
          markdown,
        }
      }

      return r
    }

    throw new Error(`Cannot find item slug: ${slug}`)
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  private _updateSrsLevel (dSrsLevel: number) {
    return async (slug: string) => {
      if (!this.user) {
        return null
      }

      const card = await DbCardModel.findById(slug).select({ quizId: 1 })

      if (!card) {
        throw new Error(`Card ${slug} not found.`)
      }

      const quiz = await DbQuizModel.findById(card.quizId).select({ stat: 1, srsLevel: 1 })

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
        await DbCardModel.updateOne({ slug }, {
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
    useFindAndModify: true,
  })

  db = new Db()
}
