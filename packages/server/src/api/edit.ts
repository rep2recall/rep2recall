import { FastifyInstance } from 'fastify'

import { DbCardModel, qSearch } from '../db/model'
import { sEntry } from '../db/schema'

const router = (f: FastifyInstance, _: any, next: () => void) => {
  f.get(
    '/',
    {
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
          200: sEntry
        }
      }
    },
    async (req) => {
      const { key } = req.query

      const r = await DbCardModel.findOne({
        userId: req.session.user._id,
        key
      }).select({ _id: 0 })

      if (r) {
        return r.toJSON()
      }

      return null
    }
  )

  f.post(
    '/',
    {
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
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: sEntry
              },
              count: { type: 'integer' }
            }
          }
        }
      }
    },
    async (req) => {
      let { q, cond, offset = 0, limit, sort } = req.body

      if (typeof q === 'string') {
        q = qSearch.parse(q).cond
      }

      if (cond) {
        q = { $and: [q, cond] }
      }

      const r = await DbCardModel.aggregate([
        { $match: { userId: req.session.user._id } },
        { $match: q },
        {
          $facet: {
            data: [
              { $sort: { [sort.key]: sort.desc ? -1 : 1 } },
              { $skip: offset },
              ...(limit ? [{ $limit: limit }] : []),
              { $project: { _id: 0 } }
            ],
            count: [{ $count: 'count' }]
          }
        }
      ])

      return {
        data: r[0].data,
        count: (r[0].count[0] || {}).count || 0
      }
    }
  )

  f.put(
    '/',
    {
      schema: {
        summary: 'Create item',
        tags: ['edit'],
        body: sEntry,
        response: {
          200: {
            type: 'object',
            properties: {
              key: { type: 'string' }
            }
          }
        }
      }
    },
    async (req) => {
      const keys = await DbCardModel.uInsert(req.session.user._id, [req.body])

      return {
        key: keys[0]
      }
    }
  )

  f.put(
    '/multi',
    {
      schema: {
        summary: 'Create multiple items',
        tags: ['edit'],
        body: {
          type: 'object',
          required: ['entries'],
          properties: {
            entries: { type: 'array', items: sEntry }
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
    },
    async (req) => {
      const keys = await DbCardModel.uInsert(
        req.session.user._id,
        req.body.entries
      )

      return {
        keys
      }
    }
  )

  f.patch(
    '/',
    {
      schema: {
        summary: 'Update items',
        tags: ['edit'],
        body: {
          type: 'object',
          required: ['keys', 'set'],
          properties: {
            keys: { type: 'array', items: { type: 'string' } },
            set: sEntry
          }
        }
      }
    },
    async (req, reply) => {
      const { keys, set } = req.body
      await DbCardModel.uUpdate(req.session.user._id, keys, set)

      return reply.status(201).send()
    }
  )

  f.delete(
    '/',
    {
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
    },
    async (req, reply) => {
      const { keys } = req.body
      await DbCardModel.deleteMany({
        userId: req.session.user._id,
        key: { $in: keys }
      })

      return reply.status(201).send()
    }
  )

  f.get(
    '/tag',
    {
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
    },
    async (req) => {
      const r = await DbCardModel.aggregate([
        { $match: { userId: req.session.user._id } },
        { $project: { tag: 1 } },
        { $group: { _id: null, tag: { $addToSet: '$tag' } } }
      ])

      return {
        tags: r[0].tag || []
      }
    }
  )

  f.patch(
    '/tag/add',
    {
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
    },
    async (req, reply) => {
      const { keys, tags } = req.body
      await DbCardModel.uAddTag(req.session.user._id, keys, tags)

      return reply.status(201).send()
    }
  )

  f.patch(
    '/tag/remove',
    {
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
    },
    async (req, reply) => {
      const { keys, tags } = req.body
      await DbCardModel.uRemoveTag(req.session.user._id, keys, tags)

      return reply.status(201).send()
    }
  )

  next()
}

export default router
