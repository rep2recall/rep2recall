import { FastifyInstance } from 'fastify'
import escapeRegExp from 'escape-string-regexp'

import { db } from '../config'
import { shuffle } from '../db/util'

const router = (f: FastifyInstance, _: any, next: () => void) => {
  f.get('/lessons', {
    schema: {
      summary: 'List all lessons',
      tags: ['quiz'],
      response: {
        200: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async () => {
    const entries = db.allLessons()
    return {
      entries
    }
  })

  f.post('/', {
    schema: {
      summary: 'Query for card ids, for use in quiz',
      tags: ['quiz'],
      body: {
        type: 'object',
        required: ['q', 'deck', 'lesson'],
        properties: {
          q: { type: ['string', 'object'] },
          deck: { type: 'string' },
          lesson: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            keys: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async (req) => {
    const { q, deck, lesson } = req.body
    const cond = typeof q === 'string' ? db.qSearch.parse(q).cond : q

    const $and = [
      cond
    ]

    $and.push({
      $or: [
        { 'lesson.deck': deck },
        { 'lesson.deck': { $regex: new RegExp(`^${escapeRegExp(deck)}/`) } }
      ]
    })

    $and.push({
      $or: [
        { nextReview: { $exists: false } },
        { nextReview: null },
        { nextReview: { $lte: new Date() } }
      ]
    })

    $and.push({
      'lesson.name': lesson,
      'lesson.deck': { $exists: true }
    })

    return {
      keys: shuffle(db.find({ $and }).map((c) => c.key))
    }
  })

  f.post('/stat', {
    schema: {
      summary: 'Query for card statistics, for use in due treeview',
      tags: ['quiz'],
      body: {
        type: 'object',
        required: ['q', 'lesson'],
        properties: {
          q: { type: ['string', 'object'] },
          lesson: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              deck: { type: 'string' },
              new: { type: 'integer' },
              due: { type: 'integer' },
              leech: { type: 'integer' }
            }
          }
        }
      }
    }
  }, async (req) => {
    const { q, lesson } = req.body
    const cond = typeof q === 'string' ? db.qSearch.parse(q).cond : q

    const rs = db.find({
      $and: [
        cond,
        {
          'lesson.name': lesson
        }
      ]
    }).map((r) => {
      if (r.lesson) {
        r.deck = r.lesson.map((ls) => ls.deck)[0]
      }

      return r
    })

    const deckStat: Record<string, {
      due: number
      leech: number
      new: number
    }> = {}

    const now = new Date().toString()

    rs.map((c) => {
      if (c.deck) {
        deckStat[c.deck] = deckStat[c.deck] || {
          due: 0,
          leech: 0,
          new: 0
        }

        if (!c.nextReview) {
          deckStat[c.deck].new += 1
        } else if (c.nextReview < now) {
          deckStat[c.deck].due += 1
        }

        if (c.srsLevel === 0) {
          deckStat[c.deck].leech += 1
        }
      }
    })

    return Object.entries(deckStat).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      ...v,
      deck: k
    }))
  })

  f.post('/info', {
    schema: {
      summary: 'Render a quiz item',
      tags: ['quiz'],
      body: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {},
            ref: { type: 'array', items: { type: 'string' } },
            markdown: { type: 'string' }
          }
        }
      }
    }
  }, async (req) => {
    return db.renderMin(req.body.key)
  })

  f.patch('/right', {
    schema: {
      summary: 'Mark as right',
      tags: ['quiz'],
      querystring: {
        key: { type: 'string' }
      }
    }
  }, async (req) => {
    db.markRight(req.query.key)
    return {
      error: null
    }
  })

  f.patch('/wrong', {
    schema: {
      summary: 'Mark as wrong',
      tags: ['quiz'],
      querystring: {
        key: { type: 'string' }
      }
    }
  }, async (req) => {
    db.markWrong(req.query.key)
    return {
      error: null
    }
  })

  f.patch('/repeat', {
    schema: {
      summary: 'Mark for repetition',
      tags: ['quiz'],
      querystring: {
        key: { type: 'string' }
      }
    }
  }, async (req) => {
    db.markRepeat(req.query.key)
    return {
      error: null
    }
  })

  next()
}

export default router
