import { FastifyInstance } from 'fastify'

import { db } from '../config'
import { removeNull, sorter } from '../db/util'
import { dbSchema } from '../db/local'

const router = (f: FastifyInstance, _: any, next: () => void) => {
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
        200: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            data: {},
            ref: { type: 'array', items: { type: 'string' } },
            markdown: { type: 'string' },
            tag: { type: 'array', items: { type: 'string' } },
            nextReview: { type: 'string', format: 'date-time' },
            srsLevel: { type: 'integer' },
            stat: {},
            lesson: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  name: { type: 'string' },
                  deck: { type: 'string' }
                }
              }
            },
            deck: { type: 'string' }
          }
        }
      }
    }
  }, async (req) => {
    const { key } = req.query
    const r = db.find({ key }, 'LIMIT 1')
    return removeNull(r[0] || {})
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
          sort: { type: 'array', items: { type: 'string' } },
          count: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  data: {},
                  ref: { type: 'array', items: { type: 'string' } },
                  markdown: { type: 'string' },
                  tag: { type: 'array', items: { type: 'string' } },
                  nextReview: { type: 'string', format: 'date-time' },
                  srsLevel: { type: 'integer' },
                  stat: {},
                  lesson: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        name: { type: 'string' },
                        deck: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            count: { type: ['integer', 'null'] }
          }
        }
      }
    }
  }, async (req) => {
    let { q, cond, offset = 0, limit, sort } = req.body

    if (typeof q === 'string') {
      q = db.qSearch.parse(q).cond
    }

    if (cond) {
      q = { $and: [q, cond] }
    }

    const allData = db.find(q)

    return {
      data: removeNull(allData.sort(sorter(
        sort.map((s: string) => s[0] === '-' ? {
          key: s.substr(1),
          type: -1
        } : {
          key: s,
          type: 1
        }),
        true
      ))).slice(offset, limit ? offset + limit : undefined),
      count: allData.length
    }
  })

  f.put('/', {
    schema: {
      summary: 'Create item',
      tags: ['edit'],
      body: dbSchema,
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
    const keys = db.insert(req.body)

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
          entries: { type: 'array', items: dbSchema }
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
          set: dbSchema
        }
      }
    }
  }, async (req) => {
    const { keys, set } = req.body
    db.update(keys, set)

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
    db.delete(...keys)

    return {
      error: null
    }
  })

  f.get('/deck', {
    schema: {
      summary: 'Get decks',
      tags: ['edit'],
      response: {
        200: {
          type: 'object',
          properties: {
            decks: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }, async () => {
    return {
      decks: db.allDecks()
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
      tags: db.allTags()
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
    db.addTags(keys, tags)

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
    db.removeTags(keys, tags)

    return {
      error: null
    }
  })

  next()
}

export default router
