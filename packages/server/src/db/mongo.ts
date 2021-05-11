import crypto from 'crypto'

import {
  Severity,
  getModelForClass,
  index,
  modelOptions,
  pre,
  prop
} from '@typegoose/typegoose'
import dayjs from 'dayjs'
import escapeRegex from 'escape-string-regexp'
import shortUUID from 'short-uuid'

import { IStatus } from '../types'
import { getNextReview, srsMap } from './quiz'
import { ISplitOpToken, removeBraces, splitOp } from './tokenize'

// eslint-disable-next-line no-use-before-define
@pre<User>('remove', async function () {
  await Promise.all([
    NoteModel.find({ user: this._id }).then((rs) =>
      rs.map((r) => r.deleteOne())
    ),
    PresetModel.deleteMany({ user: this._id })
  ])
})
class User {
  @prop({ default: () => shortUUID.generate() }) _id?: string
  @prop({ required: true, unique: true }) email!: string
  @prop({
    required: true,
    default: () => User.newApiKey()
  })
  apiKey?: string

  static newApiKey() {
    return crypto.randomBytes(64).toString('base64').replace(/=+$/, '')
  }
}

export const UserModel = getModelForClass(User, {
  schemaOptions: { timestamps: true, collection: 'User' }
})

// eslint-disable-next-line no-use-before-define
@pre<Note>('remove', async function () {
  await NoteAttrModel.deleteMany({ note: this._id })
})
@modelOptions({
  options: {
    allowMixed: Severity.ALLOW
  }
})
class Note {
  @prop({ default: () => shortUUID.generate() }) _id?: string
  @prop({ required: true }) userId!: string

  @prop({
    required: true,
    unique: true,
    default: () => shortUUID.generate()
  })
  uid?: string

  @prop({ index: true }) deck?: string
  @prop() front?: string
  @prop() back?: string
  @prop() mnemonic?: string
  @prop() data?: Record<string, unknown>
  @prop({ index: true }) tag?: string[]
  @prop({ index: true }) srsLevel?: number
  @prop({ index: true }) nextReview?: Date
  @prop({ index: true }) lastRight?: Date
  @prop({ index: true }) lastWrong?: Date
  @prop({ index: true }) rightStreak?: number
  @prop({ index: true }) wrongStreak?: number
  @prop({ index: true }) maxRight?: number
  @prop({ index: true }) maxWrong?: number

  static async search(
    q: string,
    {
      userId,
      decks = [],
      status,
      isJoinNoteAttr = false,
      post
    }: {
      userId: string
      decks?: string[]
      status?: IStatus
      isJoinNoteAttr?: boolean
      post: Record<string, Record<string, any>>[]
    }
  ): Promise<any[]> {
    const now = new Date()
    const isDeck = (d: string) => ({
      $or: [
        { deck: d },
        {
          $and: [{ deck: { $gt: `${d}::` } }, { deck: { $gt: `${d}:;` } }]
        }
      ]
    })

    let cond: Record<string, any> | null = null

    if (status) {
      const $or: Record<string, any>[] = []

      if (status.new) {
        $or.push({ srsLevel: { $exists: false } })
      }

      if (status.graduated) {
        $or.push({ srsLevel: { $exists: true } })
      } else {
        $or.push({ srsLevel: { $lte: 3 } })
      }

      if (status.leech) {
        $or.push({ srsLevel: 0 }, { wrongStreak: { $gt: 2 } })
      }

      if (status.due) {
        cond = {
          $or: [
            ...$or,
            { nextReview: { $exists: false } },
            { nextReview: { $lt: now } }
          ]
        }
      } else {
        if ($or.length) {
          cond = { $or }
        }
      }
    }

    if (decks.length) {
      const $and: Record<string, any>[] = decks.map((d) => isDeck(d))
      if (cond) {
        $and.push(cond)
      }

      cond = { $and }
    }

    const cmp = {
      _(p: ISplitOpToken, type: 'string' | 'date' | 'float' | 'integer') {
        if (!p.k) {
          return this.noKey(p)
        }

        if (p.v === 'NULL' && ['=', ':'].includes(p.op as string)) {
          return { [p.k]: { $exists: false } }
        }

        if (type === 'date') {
          let v = now
          try {
            v = dayjs(p.v).toDate() || now
          } catch (_) {}

          p.v = v as any
        } else if (type === 'integer') {
          p.v = parseInt(p.v) as any
        } else if (type === 'float') {
          p.v = parseFloat(p.v) as any
        }

        const $op = (
          {
            '>': '$gt',
            '>=': '$gte',
            '<': '$lt',
            '<=': '$lte',
            '=': '$literal'
          } as Record<string, string>
        )[p.op!]

        if (!$op && p.op !== '~') {
          return { [p.k]: { $regex: new RegExp(escapeRegex(p.v), 'i') } }
        }

        if ($op === '$literal') {
          return { [p.k]: p.v }
        }

        return { [p.k]: { [$op || '$regex']: p.v } }
      },
      anyKey(p: ISplitOpToken) {
        isJoinNoteAttr = true

        const q = this._(
          {
            ...p,
            k: 'attr.value'
          },
          'string'
        )

        if (p.k) {
          return {
            $and: [{ 'attr.key': removeBraces(p.k) }, q]
          }
        }

        return {
          $or: [
            q,
            this._(
              {
                ...p,
                k: 'tag'
              },
              'string'
            )
          ]
        }
      },
      noKey(p: ISplitOpToken) {
        const cond = isDeck(p.v)
        cond.$or.push(this.anyKey(p) as any)
        return cond
      }
    }

    const whenK = (p: ISplitOpToken) => {
      if (!p.k) {
        return cmp.noKey(p)
      }

      if (p.k === 'deck' && p.v === ':') {
        return isDeck(p.v)
      }

      if (['uid', 'tag', 'deck'].includes(p.k)) {
        return cmp._(p, 'string')
      } else if (
        [
          'srsLevel',
          'rightStreak',
          'wrongStreak',
          'maxRight',
          'maxWrong'
        ].includes(p.k)
      ) {
        return cmp._(p, 'integer')
      } else if (['nextReview', 'lastRight', 'lastWrong'].includes(p.k)) {
        return cmp._(p, 'date')
      }

      return cmp.anyKey(p)
    }

    const andOp: ISplitOpToken[] = []
    const orOp: ISplitOpToken[] = []
    const notOp: ISplitOpToken[] = []

    splitOp(q).map((p) => {
      if (p.prefix === '-') {
        notOp.push(p)
        return
      } else if (p.prefix === '?') {
        orOp.push(p)
        return
      }
      andOp.push(p)
    })

    const $and: any[] = andOp.map((p) => whenK(p))

    if (orOp.length) {
      $and.push({ $or: orOp.map((p) => whenK(p)) })
    }

    if (notOp.length) {
      $and.push({ $nor: notOp.map((p) => whenK(p)) })
    }

    const where: Record<string, Record<string, any>>[] = [
      { $match: { userId } }
    ]

    if ($and.length) {
      cond = cond ? { $and: [cond, ...$and] } : { $and }
    }

    if (cond) {
      if (isJoinNoteAttr) {
        where.push(
          {
            $lookup: {
              from: 'NoteAttr',
              localField: '_id',
              foreignField: 'note',
              as: 'attr'
            }
          },
          {
            $unwind: {
              path: '$attr',
              preserveNullAndEmptyArrays: false
            }
          }
        )
      }

      where.push({ $match: cond })

      if (isJoinNoteAttr) {
        where.push({
          $group: {
            _id: '$_id',
            attr: {
              $push: {
                key: '$attr.key',
                value: '$attr.value'
              }
            },
            ...[
              'uid',
              'deck',
              'front',
              'back',
              'mnemonic',
              'data',
              'tag',
              'srsLevel',
              'nextReview',
              'lastRight',
              'lastWrong',
              'rightStreak',
              'wrongStreak',
              'maxRight',
              'maxWrong',
              'createdAt',
              'updatedAt'
            ].reduce(
              (prev, k) => ({
                ...prev,
                [k]: { $first: `$${k}` }
              }),
              {} as Record<string, { $first: string }>
            )
          }
        })
      }
    }

    return NoteModel.aggregate([...where, ...post])
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  private _updateSrsLevel(dSrsLevel: number) {
    return () => {
      if (dSrsLevel > 0) {
        this.rightStreak = this.rightStreak || 0
        this.rightStreak++
        this.wrongStreak = 0
        this.lastRight = new Date()

        if (
          typeof this.maxRight === 'undefined' ||
          this.rightStreak > this.maxRight
        ) {
          this.maxRight = this.rightStreak
        }
      } else if (dSrsLevel < 0) {
        this.wrongStreak = this.wrongStreak || 0
        this.wrongStreak++
        this.rightStreak = 0
        this.lastWrong = new Date()

        if (
          typeof this.maxWrong === 'undefined' ||
          this.wrongStreak > this.maxWrong
        ) {
          this.maxWrong = this.wrongStreak
        }
      }

      this.srsLevel = this.srsLevel || 0
      this.srsLevel++

      if (this.srsLevel >= srsMap.length) {
        this.srsLevel = srsMap.length - 1
      }

      if (this.srsLevel < 0) {
        this.srsLevel = 0
      }

      if (dSrsLevel > 0) {
        this.nextReview = getNextReview(this.srsLevel)
      }
    }
  }
}

export const NoteModel = getModelForClass(Note, {
  schemaOptions: { timestamps: true, collection: 'Note' }
})

@index({ key: 1, noteId: 1 }, { unique: true })
class NoteAttr {
  @prop({ required: true }) noteId!: string

  @prop({ required: true }) key!: string
  @prop({ required: true }) value!: string
}

export const NoteAttrModel = getModelForClass(NoteAttr, {
  schemaOptions: { timestamps: true, collection: 'NoteAttr' }
})

@modelOptions({
  options: {
    allowMixed: Severity.ALLOW
  }
})
class Preset {
  @prop({ default: () => shortUUID.generate() }) _id?: string
  @prop({ required: true }) userId!: string

  @prop({ validate: (q) => typeof q !== 'undefined' }) q!: string
  @prop({ required: true }) name!: string
  @prop({ required: true }) status!: IStatus
  @prop({ required: true }) selected!: string[]
  @prop({ required: true }) opened!: string[]
}

export const PresetModel = getModelForClass(Preset, {
  schemaOptions: { timestamps: true, collection: 'Preset' }
})
