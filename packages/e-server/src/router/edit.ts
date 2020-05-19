import { FastifyInstance } from 'fastify'
import $RefParser from '@apidevtools/json-schema-ref-parser'

import { db } from '../config'
import schema from '../schema/schema.json'

const router = async (f: FastifyInstance, _: any, next: () => void) => {
  f.get('/', {
    schema: {
      tags: ['edit'],
      summary: 'Get info of an item',
      querystring: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      },
      response: {
        200: (await $RefParser.dereference(schema as any)).definitions!.QueryItem
      }
    },
    handler: async (req, reply) => {
      const { key } = req.query
      const c = db.get(key)

      return c || reply.status(404).send()
    }
  })

  f.post('/', {
    schema: {
      tags: ['edit'],
      summary: 'Query for items',
      body: {
        type: 'object',
        required: ['q', 'offset', 'limit', 'sort'],
        properties: {
          q: { type: ['string', 'object'] },
          offset: { type: 'integer' },
          limit: { type: ['integer', 'null'] },
          sort: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            result: {
              type: 'array',
              items: (await $RefParser.dereference(schema as any)).definitions!.QueryItemPartial
            },
            count: { type: 'integer' }
          }
        }
      }
    }
  }, async (req) => {
    const { q, offset = 0, limit, sort } = req.body

    const result: any[] = []
    let count: number = 0

    await Promise.all([
      new Promise((resolve, reject) => {
        db.query(q, { offset, limit, sort })
          .subscribe(
            ({ value }) => result.push(value),
            reject,
            resolve
          )
      }),
      new Promise((resolve, reject) => {
        db.query(q, { fields: ['cardId'] })
          .subscribe(
            () => count++,
            reject,
            resolve
          )
      })
    ])

    return {
      result,
      count
    }
  })

  f.put('/', {
    schema: {
      summary: 'Create item',
      tags: ['edit'],
      body: {
        $ref: 'schema.json#/definitions/InsertItem'
      },
      response: {
        200: {
          type: 'object',
          properties: {
            key: { type: 'string' }
          }
        }
      }
    }
  }, async (req) => {
    const keyMap = db.insert(req.body)

    return {
      key: Array.from(keyMap)[0][1]
    }
  })

  f.put('/multi', {
    schema: {
      summary: 'Create multiple items',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['entries'],
        properties: {
          entries: {
            type: 'array',
            items: {
              $ref: 'schema.json#/definitions/InsertItem'
            }
          }
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
    const keys = db.insert(...req.body.entries)

    return {
      keys: Array.from(keys.keys())
    }
  })

  f.patch('/', {
    schema: {
      summary: 'Update items',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['keys', 'set'],
        properties: {
          keys: { type: 'array', items: { type: 'string' }, minLength: 1 },
          set: { $ref: 'schema.json#/definitions/UpdateItem' }
        }
      }
    }
  }, async (req, reply) => {
    const { keys, set } = req.body
    db.update(keys, set)
    reply.status(201).send()
  })

  f.delete('/', {
    schema: {
      summary: 'Delete items',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['keys'],
        properties: {
          keys: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const { keys } = req.body
    db.delete(...keys)
    reply.status(201).send()
  })

  f.get('/deck', {
    schema: {
      summary: 'Get decks',
      tags: ['edit'],
      querystring: {
        type: 'object',
        required: ['lesson'],
        properties: {
          lesson: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            decks: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    handler: async (req) => {
      return {
        decks: db.allDeck(req.query.lesson)
      }
    }
  })

  f.get('/tag', {
    schema: {
      summary: 'Get tags',
      tags: ['edit'],
      response: {
        200: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async () => {
    return {
      tags: db.allTag()
    }
  })

  f.patch('/tag/add', {
    schema: {
      summary: 'Add tags',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['keys', 'tags'],
        properties: {
          keys: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const { keys, tags } = req.body
    db.addTag(keys, tags)
    reply.status(201).send()
  })

  f.patch('/tag/remove', {
    schema: {
      summary: 'Add tags',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['keys', 'tags'],
        properties: {
          keys: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const { keys, tags } = req.body
    db.removeTag(keys, tags)
    reply.status(201).send()
  })

  next()
}

export default router
