import { FastifyInstance } from 'fastify'

import { db } from '../db/schema'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
  f.get('/', {
    schema: {
      tags: ['edit'],
      summary: 'Get info of an item',
      querystring: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    const { id } = req.query

    return await db.render(id)
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
            properties: {
              key: { type: 'string' },
              desc: { type: 'boolean' },
            },
          },
        },
      },
    },
  }, async (req) => {
    let { q, cond, offset = 0, limit, sort } = req.body

    if (typeof q === 'string') {
      q = db.qSearch.parse(q).cond
    }

    if (cond) {
      q = { $and: [q, cond] }
    }

    let c = db.db.find(q).sort({
      [sort.key]: sort.desc ? -1 : 1,
    }).skip(offset)

    if (limit) {
      c = c.limit(limit)
    }

    const [rData, rCount] = await Promise.all([
      c,
      db.db.count(q),
    ])

    return {
      data: rData,
      count: rCount,
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
            id: { type: 'integer' },
          },
        },
      },
    },
  }, async (req) => {
    const docs = await db.insert(req.body)
    const { error } = docs as any

    if (error) {
      console.error(error)
      throw new Error('Cannot insert')
    }

    return {
      ids: (docs as any[]).map((el) => el._id),
    }
  })

  f.patch('/', {
    schema: {
      summary: 'Update items',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['ids', 'set'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' } },
          set: { type: 'object' },
        },
      },
    },
  }, async (req) => {
    const { ids, set } = req.body
    await db.set({
      _id: { $in: ids },
    }, set)

    return {
      error: null,
    }
  })

  f.delete('/', {
    schema: {
      summary: 'Delete items',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  }, async (req) => {
    const { ids } = req.body
    await db.db.remove({
      _id: { $in: ids },
    }, { multi: true })

    return {
      error: null,
    }
  })

  f.patch('/tag/add', {
    schema: {
      summary: 'Add tags',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['ids', 'tags'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' } },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req) => {
    const { ids, tags } = req.body
    await db.db.update({
      _id: { $in: ids },
    }, {
      $addToSet: { tag: { $each: tags } },
    })

    return {
      error: null,
    }
  })

  f.patch('/tag/remove', {
    schema: {
      summary: 'Add tags',
      tags: ['edit'],
      body: {
        type: 'object',
        required: ['ids', 'tags'],
        properties: {
          ids: { type: 'array', items: { type: 'integer' } },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req) => {
    const { ids, tags } = req.body
    await db.db.update({
      _id: { $in: ids },
    }, {
      $pull: { tag: { $in: tags } },
    })

    return {
      error: null,
    }
  })

  next()
}

export default router
