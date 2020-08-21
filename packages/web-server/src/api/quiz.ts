import { FastifyInstance } from 'fastify'
import escapeRegExp from 'escape-string-regexp'
import { DbCardModel, qSearch } from '../db/model'

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
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (req) => {
    const r = await DbCardModel.aggregate([
      { $match: { userId: req.session.user._id } },
      { $group: { _id: '$deck.lessonId' } },
      {
        $lookup: {
          from: 'lesson',
          localField: '_id',
          foreignField: '_id',
          as: 'ls'
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: '$ls.name',
          description: '$ls.description'
        }
      }
    ])

    return {
      entries: r
    }
  })

  f.post('/', {
    schema: {
      summary: 'Query for card ids, for use in quiz',
      tags: ['quiz'],
      body: {
        type: 'object',
        required: ['q', 'deck'],
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
    const cond = typeof q === 'string' ? qSearch.parse(q).cond : q

    const $and = [
      cond
    ]

    $and.push({
      $or: [
        { 'deck.name': deck },
        { 'deck.name': new RegExp(`^${escapeRegExp(deck)}/`) }
      ]
    })

    $and.push({
      $or: [
        { nextReview: { $exists: false } },
        { nextReview: { $lte: new Date() } }
      ]
    })

    $and.push({
      'deck.lessonId': lesson || { $exists: false }
    })

    const rs = await DbCardModel.aggregate([
      { $match: { userId: req.session.user._id } },
      { $match: { $and } },
      {
        $project: {
          key: 1,
          _id: 0
        }
      }
    ])

    for (let i = rs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rs[i], rs[j]] = [rs[j], rs[i]]
    }

    return {
      keys: rs.map((c) => c.key)
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
    const cond = typeof q === 'string' ? qSearch.parse(q).cond : q

    const rs = await DbCardModel.aggregate([
      { $match: { userId: req.session.user._id } },
      {
        $match: {
          $and: [
            cond,
            {
              'deck.lessonId': lesson || { $exists: false }
            }
          ]
        }
      },
      {
        $project: {
          deck: '$deck.name',
          nextReview: '$quiz.nextReview',
          srsLevel: '$quiz.srsLevel',
          _id: 0
        }
      }
    ])

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
    const r = await DbCardModel.findOne({
      userId: req.session.user._id,
      key: req.query.key
    }).select({
      data: 1,
      ref: 1,
      markdown: 1
    })

    return r ? r.toJSON() : null
  })

  f.patch('/right', {
    schema: {
      summary: 'Mark as right',
      tags: ['quiz'],
      querystring: {
        key: { type: 'string' }
      }
    }
  }, async (req, reply) => {
    const r = await DbCardModel.findOne({
      userId: req.session.user._id,
      key: req.query.key
    })

    if (r) {
      r.markRight()
      await r.save()
    }

    return reply.status(201).send()
  })

  f.patch('/wrong', {
    schema: {
      summary: 'Mark as wrong',
      tags: ['quiz'],
      querystring: {
        key: { type: 'string' }
      }
    }
  }, async (req, reply) => {
    const r = await DbCardModel.findOne({
      userId: req.session.user._id,
      key: req.query.key
    })

    if (r) {
      r.markWrong()
      await r.save()
    }

    return reply.status(201).send()
  })

  f.patch('/repeat', {
    schema: {
      summary: 'Mark for repetition',
      tags: ['quiz'],
      querystring: {
        key: { type: 'string' }
      }
    }
  }, async (req, reply) => {
    const r = await DbCardModel.findOne({
      userId: req.session.user._id,
      key: req.query.key
    })

    if (r) {
      r.markRepeat()
      await r.save()
    }

    return reply.status(201).send()
  })

  next()
}

export default router
