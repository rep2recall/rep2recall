import { FastifyInstance } from 'fastify'
import escapeRegExp from 'escape-string-regexp'

import { db, DbCardModel } from '../db/schema'
import { shuffle } from '../utils'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
  f.get('/lessons', {
    schema: {
      summary: 'List all lessons',
      tags: ['quiz']
    }
  }, async () => {
    return {
      entries: await db.listLessons()
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
        { deck },
        { deck: new RegExp(`^${escapeRegExp(deck)}/`) }
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
      'lesson.key': lesson,
      'lesson.deck': { $exists: true }
    })

    const rs = await DbCardModel.stdLookup({
      postConds: [
        {
          $addFields: {
            deck: '$lesson.deck'
          }
        },
        { $match: { $and } },
        {
          $project: {
            key: 1,
            _id: 0
          }
        }
      ]
    })

    return {
      keys: shuffle(rs.map((c) => c.key))
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
      }
    }
  }, async (req) => {
    const { q, lesson } = req.body
    const cond = typeof q === 'string' ? db.qSearch.parse(q).cond : q

    const rs = await DbCardModel.stdLookup({
      postConds: [
        {
          $match: {
            $and: [
              cond,
              {
                'lesson.key': lesson,
                'lesson.deck': { $exists: true }
              }
            ]
          }
        },
        {
          $project: {
            deck: '$lesson.deck',
            nextReview: 1,
            srsLevel: 1,
            _id: 0
          }
        }
      ]
    })

    const deckStat: Record<string, {
      due: number
      leech: number
      new: number
    }> = {}

    const now = new Date()

    rs.map((c) => {
      if (c.deck) {
        c.deck = c.deck[0]

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

  f.get('/', {
    schema: {
      summary: 'Render a quiz item',
      tags: ['quiz'],
      querystring: {
        key: { type: 'string' }
      }
    }
  }, async (req) => {
    return await db.render(req.query.key, {
      min: true
    })
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
    await db.markRight(req.query.key)
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
    await db.markWrong(req.query.key)
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
    await db.markRepeat(req.query.key)
    return {
      error: null
    }
  })

  next()
}

export default router
