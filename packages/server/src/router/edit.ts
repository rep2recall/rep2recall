import { FastifyInstance } from 'fastify'

import { db } from '../db/schema'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
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
          limit: { type: 'integer' },
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
    const { q, offset = 0, limit, sort } = req.body

    const [rData, rCount] = await Promise.all([
      db.find(q, {
        offset,
        limit,
        sort,
      }),
      db.find(q, {
        projection: ['id'],
      }),
    ])

    return {
      data: rData,
      count: rCount.length,
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
    const ids = await db.insert(req.body)

    return {
      id: ids[0],
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
    await db.update(ids, set)

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
    await db.delete(ids)

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
    await db.update(ids, (ent) => {
      return {
        tag: Array.from(new Set([...(ent.tag || []), ...tags])),
      }
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
    await db.update(ids, (ent) => {
      return {
        tag: ent.tag ? ent.tag.filter((t) => !tags.includes(t)) : [],
      }
    })

    return {
      error: null,
    }
  })

  next()
}

export default router
