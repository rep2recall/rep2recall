import { FastifyInstance } from 'fastify'
import $RefParser from '@apidevtools/json-schema-ref-parser'

import { db } from '../config'
import { shuffle } from '../util'
import schema from '../schema/schema.json'

const router = async (f: FastifyInstance, _: any, next: () => void) => {
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
    const entries = db.allLesson()
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
    const $and = [] as any[]

    $and.push({
      $or: [
        { deck },
        { deck: { $like: `${deck}/%` } }
      ]
    })

    $and.push({
      lesson
    })

    const keys = new Set<string>()

    await new Promise((resolve, reject) => {
      db.query([q, { $and }], {
        fields: ['key']
      }).subscribe(
        ({ value: { key } }) => {
          if (key) {
            keys.add(key)
          }
        },
        reject,
        resolve
      )
    })

    return {
      keys: shuffle(Array.from(keys))
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

    const rs: any[] = []

    await new Promise((resolve, reject) => {
      db.query([
        q,
        { lesson }
      ], {
        fields: ['deck', 'stat', 'srsLevel', 'nextReview']
      }).subscribe(
        ({ value }) => rs.push(value),
        reject,
        resolve
      )
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

  f.get('/', {
    schema: {
      summary: 'Render a quiz item',
      tags: ['quiz'],
      querystring: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      },
      response: {
        200: (await $RefParser.dereference(schema as any)).definitions!.RenderItemMin
      }
    },
    handler: async (req) => {
      return db.renderMin(req.query.key)
    }
  })

  f.patch('/right', {
    schema: {
      summary: 'Mark as right',
      tags: ['quiz'],
      querystring: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    db.markRight(req.query.key)
    reply.status(201).send()
  })

  f.patch('/wrong', {
    schema: {
      summary: 'Mark as wrong',
      tags: ['quiz'],
      querystring: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    db.markWrong(req.query.key)
    reply.status(201).send()
  })

  f.patch('/repeat', {
    schema: {
      summary: 'Mark for repetition',
      tags: ['quiz'],
      querystring: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    db.markRepeat(req.query.key)
    reply.status(201).send()
  })

  next()
}

export default router
