import { FastifyInstance } from 'fastify'

import { db, DbTagModel, DbDeckModel, DbCardModel } from '../db/schema'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
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
      }
    }
  }, async (req) => {
    const { key } = req.query

    return await db.render(key, {
      min: false
    })
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
          cond: { type: 'object' },
          offset: { type: 'integer' },
          limit: { type: ['integer', 'null'] },
          sort: {
            type: 'object',
            required: ['key'],
            properties: {
              key: { type: 'string' },
              desc: { type: 'boolean' }
            }
          },
          count: { type: 'boolean' }
        }
      }
    }
  }, async (req) => {
    let { q, cond, offset = 0, limit, sort, count } = req.body

    if (typeof q === 'string') {
      q = db.qSearch.parse(q).cond
    }

    if (cond) {
      q = { $and: [q, cond] }
    }

    const [rData, rCount] = await Promise.all([
      DbCardModel.stdLookup({
        postConds: [
          { $match: q },
          { $sort: { [sort.key]: sort.desc ? -1 : 1 } },
          { $skip: offset },
          ...(limit ? [
            { $limit: limit }
          ] : [])
        ]
      }),
      count ? DbCardModel.stdLookup({
        postConds: [
          { $match: q },
          { $count: 'count' }
        ]
      }) : null
    ])

    return {
      data: rData,
      count: rCount ? rCount[0].count : null
    }
  })

  f.put('/', {
    schema: {
      summary: 'Create item',
      tags: ['edit'],
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
    const keys = await db.create(req.body)

    return {
      key: keys[0]
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
          entries: { type: 'array', items: { type: 'object' } }
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
    const keys = await db.create(...req.body.entries)

    return {
      keys
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
          keys: { type: 'array', items: { type: 'string' } },
          set: { type: 'object' }
        }
      }
    }
  }, async (req) => {
    const { keys, set } = req.body
    await db.update(keys, set)

    return {
      error: null
    }
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
  }, async (req) => {
    const { keys } = req.body
    await db.delete(...keys)

    return {
      error: null
    }
  })

  f.get('/deck', {
    schema: {
      summary: 'Get decks',
      tags: ['edit']
    }
  }, async () => {
    return {
      decks: (await DbDeckModel.find().select({ name: 1 })).map((t) => t.name)
    }
  })

  f.get('/tag', {
    schema: {
      summary: 'Get tags',
      tags: ['edit']
    }
  }, async () => {
    return {
      tags: (await DbTagModel.find().select({ name: 1 })).map((t) => t.name)
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
  }, async (req) => {
    const { keys, tags } = req.body
    await db.addTags(keys, tags)

    return {
      error: null
    }
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
  }, async (req) => {
    const { keys, tags } = req.body
    await db.removeTags(keys, tags)

    return {
      error: null
    }
  })

  next()
}

export default router
