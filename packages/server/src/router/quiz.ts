import { FastifyInstance } from 'fastify'
import QSearch from '@patarapolw/qsearch'
import dayjs from 'dayjs'

import { db } from '../db/schema'

const qSearch = new QSearch({
  dialect: 'liteorm',
  schema: {
    deck: {},
    template: {},
    qfmt: {},
    afmt: {},
    front: {},
    back: {},
    source: {},
    data: {},
    mnemonic: {},
    srsLevel: { type: 'number' },
    nextReview: { type: 'date' },
    tag: {},
  },
})

const router = (f: FastifyInstance, opts: any, next: () => void) => {
  f.post('/', {
    schema: {
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
      typeof q === 'string' ? qSearch.parse(q).cond : q,
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
            deck: { $like: `${deck}/%` },
          },
        ]
      }).reduce((a, b) => [...a, ...b])
    }

    if (type !== 'all') {
      if (type === 'due') {
        $or.map((cond) => {
          cond.nextReview = { $lte: +new Date() }
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
            cond.nextReview = { $lte: +dayjs().add(parseFloat(m[1]), m[2] as any).toDate() }
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
            nextReview: { $lte: +new Date() },
          },
        ]
      }).reduce((a, b) => [...a, ...b])
    }

    const ids = await db.find({ $or }, {
      projection: [
        'id',
        'deck', 'template', 'qfmt', 'afmt', 'front', 'back', 'mnemonic', 'source', 'data',
      ],
    })
  })

  next()
}
