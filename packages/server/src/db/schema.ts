import * as z from 'zod'

export const zDeck = z.object({
  id: z.string().optional(),
  name: z.string(),
  lessonId: z.string().optional(),
  lesson: z.string().optional()
})

export type IDeck = z.infer<typeof zDeck>

export const sDeck = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    lesson: { type: 'string' }
  }
}

export const zQuizStatistics = z.object({
  nextReview: z.date(),
  srsLevel: z.number(),
  streak: z.object({
    right: z.number(),
    wrong: z.number(),
    maxRight: z.number(),
    maxWrong: z.number()
  }),
  lastRight: z.date().optional(),
  lastWrong: z.date().optional()
})

export type IQuizStatistics = z.infer<typeof zQuizStatistics>

export const sQuizStatistics = {
  type: 'object',
  required: ['nextReview', 'srsLevel', 'streak'],
  additionalProperties: false,
  properties: {
    nextReview: { type: 'string', format: 'date-time' },
    srsLevel: { type: 'integer' },
    streak: {
      type: 'object',
      required: ['right', 'wrong', 'maxRight', 'maxWrong'],
      properties: {
        right: { type: 'integer' },
        wrong: { type: 'integer' },
        maxRight: { type: 'integer' },
        maxWrong: { type: 'integer' }
      }
    },
    lastRight: { type: 'string', format: 'date-time' },
    lastWrong: { type: 'string', format: 'date-time' }
  }
}

export const zEntry = z.object({
  key: z.string().optional(),
  data: z.record(z.any()).optional(),
  ref: z.array(z.string()).optional(),
  tag: z.array(z.string()).optional(),
  markdown: z.string().optional(),
  deck: zDeck.optional(),
  quiz: zQuizStatistics.optional()
})

export type IEntry = z.infer<typeof zEntry>

export const sEntry = {
  type: 'object',
  additionalProperties: false,
  properties: {
    key: { type: 'string' },
    data: {
      type: 'object',
      additionalProperties: true
    },
    ref: { type: 'array', items: { type: 'string' } },
    tag: { type: 'array', items: { type: 'string' } },
    markdown: { type: 'string' },
    deck: sDeck,
    quiz: sQuizStatistics
  }
}
