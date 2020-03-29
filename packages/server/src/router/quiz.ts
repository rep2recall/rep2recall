import { FastifyInstance } from 'fastify'
import dayjs from 'dayjs'
import escapeRegExp from 'escape-string-regexp'

import { db } from '../db/schema'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
  f.post('/', {
    schema: {
      summary: 'Query for card ids, for use in due treeview',
      tags: ['quiz'],
      body: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: ['string', 'object'] },
          deck: { type: 'string' },
          type: { type: 'string' },
          due: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    const { q, deck, type, due } = req.body

    let $or = [
      typeof q === 'string' ? db.qSearch.parse(q).cond : q,
    ]

    let dueOrNew = false
    if (deck) {
      $or = $or.map((cond) => {
        return [
          {
            ...cond,
            deck,
          },
          {
            ...cond,
            deck: { $regex: `^${escapeRegExp(deck)}/` },
          },
        ]
      }).reduce((a, b) => [...a, ...b])
    }

    if (type !== 'all') {
      if (type === 'due') {
        $or.map((cond) => {
          cond.nextReview = { $lte: new Date().toISOString() }
        })
      } else if (type === 'leech') {
        $or.map((cond) => {
          cond.srsLevel = 0
        })
      } else if (type === 'new') {
        $or.map((cond) => {
          cond.nextReview = { $exists: false }
        })
      } else {
        dueOrNew = true
      }
    }

    if (due) {
      const m = /(-?\d+(?:\.\d+)?\S+)/.exec(due)
      if (m) {
        try {
          $or.map((cond) => {
            cond.nextReview = { $lte: +dayjs().add(parseFloat(m[1]), m[2] as any).toISOString() }
          })
        } catch (e) {
          console.error(e)
          dueOrNew = true
        }
      } else {
        dueOrNew = true
      }
    }

    if (dueOrNew) {
      $or = $or.map((cond) => {
        return [
          {
            ...cond,
            nextReview: { $exists: false },
          },
          {
            ...cond,
            nextReview: { $lte: new Date().toISOString() },
          },
        ]
      }).reduce((a, b) => [...a, ...b])
    }

    const rs = await db.aggregate([], [
      { $match: { $or } },
      {
        $project: {
          deck: 1,
          nextReview: 1,
          srsLevel: 1,
        },
      },
    ])

    const deckStat: Record<string, {
      due: number
      leech: number
      new: number
    }> = {}

    const now = new Date()

    rs.map((c) => {
      if (c.deck) {
        deckStat[c.deck] = deckStat[c.deck] || {
          due: 0,
          leech: 0,
          new: 0,
        }

        if (!c.nextReview) {
          deckStat[c.deck].new += 1
        } else if (c.nextReview < now) {
          deckStat[c.deck].due += 1
        } else if (c.srsLevel === 0) {
          deckStat[c.deck].leech += 1
        }
      }
    })

    return Object.entries(deckStat).map(([k, v]) => ({
      ...v,
      deck: k,
    }))
  })

  f.get('/', {
    schema: {
      summary: 'Render a quiz item',
      tags: ['quiz'],
      querystring: {
        id: { type: 'integer' },
      },
    },
  }, async (req) => {
    return await db.render(req.query.id, true)
  })

  f.patch('/right', {
    schema: {
      summary: 'Mark as right',
      tags: ['quiz'],
      querystring: {
        id: { type: 'integer' },
      },
    },
  }, async (req) => {
    await db.markRight(req.query.id)
    return {
      error: null,
    }
  })

  f.patch('/wrong', {
    schema: {
      summary: 'Mark as wrong',
      tags: ['quiz'],
      querystring: {
        id: { type: 'integer' },
      },
    },
  }, async (req) => {
    await db.markWrong(req.query.id)
    return {
      error: null,
    }
  })

  f.patch('/repeat', {
    schema: {
      summary: 'Mark for repetition',
      tags: ['quiz'],
      querystring: {
        id: { type: 'integer' },
      },
    },
  }, async (req) => {
    await db.markRepeat(req.query.id)
    return {
      error: null,
    }
  })

  next()
}

export default router
