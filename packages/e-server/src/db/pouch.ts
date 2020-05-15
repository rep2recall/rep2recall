import crypto from 'crypto'

import escapeStringRegexp from 'escape-string-regexp'
import dotProp from 'dot-prop-immutable'
import { UploadedFile } from 'express-fileupload'

import { split } from './shlex'
import { repeatReview, srsMap, getNextReview } from './quiz'

export class Db {
  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  _updateSrsLevel (dSrsLevel: number) {
    return async (cardId: string) => {
      const d = await this.getQuizFromCard([cardId], ['data.stat', 'data.srsLevel'])

      let srsLevel = 0
      let stat = {
        streak: {
          right: 0,
          wrong: 0,
          maxRight: 0,
          maxWrong: 0
        }
      }
      let nextReview = repeatReview().toISOString()

      if (d[0] && d[0].type === 'quiz') {
        srsLevel = d[0].data.srsLevel
        stat = d[0].data.stat
      }

      if (dSrsLevel > 0) {
        stat = dotProp.set(stat, 'streak.right', dotProp.get(stat, 'streak.right', 0) + 1)
        stat = dotProp.set(stat, 'streak.wrong', 0)
        stat = dotProp.set(stat, 'lastRight', new Date().toISOString())

        if (dotProp.get(stat, 'streak.right', 1) > dotProp.get(stat, 'streak.maxRight', 0)) {
          stat = dotProp.set(stat, 'streak.maxRight', dotProp.get(stat, 'streak.right', 1))
        }
      } else if (dSrsLevel < 0) {
        stat = dotProp.set(stat, 'streak.wrong', dotProp.get(stat, 'streak.wrong', 0) + 1)
        stat = dotProp.set(stat, 'streak.right', 0)
        stat = dotProp.set(stat, 'lastWrong', new Date())

        if (dotProp.get(stat, 'streak.wrong', 1) > dotProp.get(stat, 'streak.maxWrong', 0)) {
          stat = dotProp.set(stat, 'streak.maxWrong', dotProp.get(stat, 'streak.wrong', 1))
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
        nextReview = getNextReview(srsLevel).toISOString()
      }

      if (!d[0]) {
        const r = await this.pouch.post({
          type: 'quiz',
          data: {
            stat,
            nextReview,
            srsLevel
          }
        })

        const c = await this.pouch.get(cardId)
        if (c.type === 'card') {
          this.pouch.put({
            _id: c._id,
            type: c.type,
            data: {
              ...c.data,
              quizId: r.id
            }
          })
        }
      } else {
        await this.pouch.put({
          _id: d[0]._id,
          type: 'quiz',
          data: {
            stat,
            nextReview,
            srsLevel
          }
        })
      }
    }
  }

  async insertMedia (file: UploadedFile, cardId: string) {
    await this.pouch.putAttachment(
      cardId,
      file.name,
      file.data,
      file.mimetype
    )
  }

  async getMedia (filename: string, cardId: string) {
    return await this.pouch.getAttachment(cardId, filename)
  }

  async allCardIds () {
    const userId = await this.getUserId()
    const r = await this.pouch.find({
      selector: {
        type: 'card',
        'data.userId': userId,
        _id: { $gte: null }
      },
      fields: ['_id']
    })
    return r.docs.map((d) => d._id)
  }

  async allLessons () {
    return await this.getLessonFromCard(await this.allCardIds())
  }

  async allTags () {
    const userId = await this.getUserId()
    const r = await this.pouch.find({
      selector: {
        type: 'card',
        'data.tag': { $elemMatch: { $in: [] } },
        'data.userId': userId
      },
      fields: ['data.tag']
    })

    return Array.from(new Set(r.docs.map((d) => {
      if (d.type === 'card') {
        return d.data.tag
      }
      return []
    }).reduce((prev, c) => [...prev, ...c], []))).sort()
  }

  async getQuizFromCard (cardIds?: string[], fields?: string[]) {
    const userId = await this.getUserId()

    const rCard = await this.pouch.find({
      selector: {
        type: 'card',
        'data.userId': userId,
        'data.quizId': { $exists: true },
        _id: cardIds ? { $in: cardIds } : { $gte: null }
      },
      fields: ['data.quizId']
    })

    const rQuiz = await this.pouch.find({
      selector: {
        type: 'quiz',
        _id: {
          $in: rCard.docs.map((d) => {
            if (d.type === 'card') {
              return d.data.quizId
            }
            return null
          }).filter((el) => el)
        }
      },
      fields
    })

    return rQuiz.docs
  }

  async getDeckFromCard (cardIds?: string[], fields?: string[]) {
    const rDeck = await this.pouch.find({
      selector: {
        type: 'deck',
        'data.cardIds': { $elemMatch: cardIds ? { $in: cardIds } : { $gte: null } }
      },
      fields
    })

    return rDeck.docs
  }

  async getLessonFromCard (cardIds?: string[], fields?: string[]) {
    const decks = await this.getDeckFromCard(cardIds, ['data.lessonId'])

    const rLesson = await this.pouch.find({
      selector: {
        type: 'lesson',
        _id: {
          $in: decks.map((d) => {
            if (d.type === 'deck') {
              return d.data.lessonId
            }
            return null
          }).filter((el) => el)
        }
      },
      fields
    })

    return rLesson.docs
  }

  _defaultLessonId: string | undefined

  async getDefaultLessonId () {
    const id = 'lesson/_'

    this._defaultLessonId = this._defaultLessonId || await this.pouch.get(id)
      .then((r) => r._id)
      .catch(async (err) => {
        console.error(err)

        const r = await this.pouch.put({
          _id: id,
          type: 'lesson',
          data: {
            name: 'Default',
            description: '',
            createdAt: new Date().toISOString()
          }
        })
        return r.id
      })

    return this._defaultLessonId
  }
}

function generateSecret () {
  return crypto.randomBytes(64).toString('base64')
}

function qToCond (q: string) {
  const fNumber = [
    'srsLevel',
    'stat.streak.right',
    'stat.streak.wrong',
    'stat.streak.maxRight',
    'stat.streak.maxWrong'
  ]
  const fDate = [
    'nextReview',
    'stat.lastRight',
    'stat.lastWring'
  ]

  const $or: any[] = []
  const cond: any = {}

  split(q || '').map((seg) => {
    let prefix = ''

    if (['+', '-', '?'].includes(seg[0])) {
      prefix = seg[0]
      seg = seg.substr(1)
    }

    let [, k, op = ':', v = seg] = /^([A-Z0-9.]+)([:><]=?).+$/i.exec(seg) || []

    const parse = (k0: string) => {
      if (prefix === '-') {
        op = ({
          ':': '$nsub',
          '>': '$lte',
          '>=': '$lt',
          '<': '$gte',
          '<=': '$gt'
        } as any)[op] || '$nsub'
      } else {
        op = ({
          ':': '$sub',
          '>': '$gt',
          '>=': '$gte',
          '<': '$lt',
          '<=': '$lte'
        } as any)[op] || '$sub'
      }

      let expr: any
      let v0: any = v

      if (!fNumber.includes(k0) && !fDate.includes(k0)) {
        if (op === '$sub') {
          expr = { [k0]: { $regex: escapeStringRegexp(v0) } }
        } else if (op === '$nsub') {
          expr = { [k0]: { $regex: `^((?!${escapeStringRegexp(v0)}).)*$` } }
        }
      }

      if (fNumber.includes(v0)) {
        v0 = parseFloat(v0)
      } else if (fDate.includes(v0)) {
        v0 = parseDate(v0)
      }

      if (!expr) {
        expr = { [k0]: { [op]: v0 } }
      }

      if (k0 === 'tag') {
        expr = { [k0]: { $elemMatch: expr[k0] } }
      }

      if (prefix === '?') {
        $or.push(expr)
      } else {
        Object.assign(cond, expr)
      }
    }

    if (!k) {
      for (const k0 of ['id', 'tag', 'lesson', 'deck']) {
        parse(k0)
      }
    } else {
      parse(k)
    }
  })

  if (!Object.keys(cond).length) {
    cond._id = { $gte: null }
  }

  if ($or.length) {
    cond.$or = $or
  }

  return cond
}

function parseDate (v: string) {
  if (v === 'NOW') {
    v = new Date().toISOString()
  } else {
    const vMillisec = (() => {
      const [, p1, p2] = /^([+-]?\d+(?:\.\d+)?)([yMwdhm])$/i.exec(v) || []
      const v0 = +new Date()
      if (p2 === 'y') {
        return v0 + parseFloat(p1) * 365 * 24 * 60 * 60 * 1000 // 365d 24h 60m 60s 1000ms
      } else if (p2 === 'M') {
        return v0 + parseFloat(p1) * 30 * 24 * 60 * 60 * 1000 // 30d 24h 60m 60s 1000ms
      } else if (p2 === 'w') {
        return v0 + parseFloat(p1) * 7 * 24 * 60 * 60 * 1000 // 7d 24h 60m 60s 1000ms
      } else if (p2 === 'd') {
        return v0 + parseFloat(p1) * 24 * 60 * 60 * 1000 // 24h 60m 60s 1000ms
      } else if (p2 === 'h') {
        return v0 + parseFloat(p1) * 60 * 60 * 1000 // 60m 60s 1000ms
      } else if (p2 === 'm') {
        return v0 + parseFloat(p1) * 60 * 1000 // 60s 1000ms
      }
      return null
    })()

    v = vMillisec ? new Date(vMillisec).toISOString() : v
  }

  return v
}
