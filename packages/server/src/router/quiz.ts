import { FastifyInstance } from 'fastify'
import dayjs from 'dayjs'

import { db } from '../db/schema'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
  // f.post('/', {
  //   schema: {
  //     summary: 'Query for card ids, for use in due treeview',
  //     tags: ['quiz'],
  //     body: {
  //       type: 'object',
  //       required: ['q'],
  //       properties: {
  //         q: { type: ['string', 'object'] },
  //         deck: { type: 'string' },
  //         type: { type: 'string' },
  //         due: { type: 'string' },
  //       },
  //     },
  //   },
  // }, async (req) => {
  //   const { q, deck, type, due } = req.body

  //   let $or = [
  //     typeof q === 'string' ? db.qSearch.parse(q).cond : q,
  //   ]

  //   let dueOrNew = false
  //   if (deck) {
  //     $or = $or.map((cond) => {
  //       return [
  //         {
  //           ...cond,
  //           deck,
  //         },
  //         {
  //           ...cond,
  //           deck: { $like: `${deck}/%` },
  //         },
  //       ]
  //     }).reduce((a, b) => [...a, ...b])
  //   }

  //   if (type !== 'all') {
  //     if (type === 'due') {
  //       $or.map((cond) => {
  //         cond.nextReview = { $lte: new Date().toISOString() }
  //       })
  //     } else if (type === 'leech') {
  //       $or.map((cond) => {
  //         cond.srsLevel = 0
  //       })
  //     } else if (type === 'new') {
  //       $or.map((cond) => {
  //         cond.nextReview = { $exists: false }
  //       })
  //     } else {
  //       dueOrNew = true
  //     }
  //   }

  //   if (due) {
  //     const m = /(-?\d+(?:\.\d+)?\S+)/.exec(due)
  //     if (m) {
  //       try {
  //         $or.map((cond) => {
  //           cond.nextReview = { $lte: +dayjs().add(parseFloat(m[1]), m[2] as any).toISOString() }
  //         })
  //       } catch (e) {
  //         console.error(e)
  //         dueOrNew = true
  //       }
  //     } else {
  //       dueOrNew = true
  //     }
  //   }

  //   if (dueOrNew) {
  //     $or = $or.map((cond) => {
  //       return [
  //         {
  //           ...cond,
  //           nextReview: { $exists: false },
  //         },
  //         {
  //           ...cond,
  //           nextReview: { $lte: new Date().toISOString() },
  //         },
  //       ]
  //     }).reduce((a, b) => [...a, ...b])
  //   }

  //   return await db.db.find({ $or })
  // })

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
