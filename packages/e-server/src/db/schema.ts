import * as z from 'zod'
import dayjs from 'dayjs'

const zDateType = z.string().refine((d) => {
  return typeof d === 'string' && isNaN(d as any) && dayjs(d).isValid()
}, 'not a Date')
const zPosInt = z.number().refine((i) => Number.isInteger(i) && i > 0, 'not positive integer')

export const zDbSchema = z.object({
  // Write option
  // onConflict: z.union([z.literal('ignore'), z.literal('overwrite')]).optional(),
  onConflict: z.string().optional(),
  // IDbCard
  id: z.string().optional(),
  data: z.record(z.any()).optional(),
  markdown: z.string().optional(),
  tag: z.array(z.string()).optional(),
  ref: z.record(z.any()).optional(),
  media: z.record(z.any()).optional(),
  // IDbLesson
  lesson: z.string().optional(),
  lessonDescription: z.string().optional(),
  deck: z.string().optional(),
  // IDbQuiz
  nextReview: zDateType.optional(),
  srsLevel: zPosInt.optional(),
  stat: z.object({
    streak: z.object({
      right: zPosInt,
      wrong: zPosInt,
      maxRight: zPosInt,
      maxWrong: zPosInt
    }),
    lastRight: zDateType,
    lastWrong: zDateType
  }).optional()
})

export type IDbSchema = z.infer<typeof zDbSchema>

export const dbSchema = {
  $id: 'https://rep2recall.net/schema/dbSchema.json',
  type: 'object',
  properties: {
    overwrite: { type: 'boolean' },
    ignoreErrors: { type: 'boolean' },
    deck: { type: 'string' },
    lesson: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          deck: { type: 'string' }
        }
      }
    },
    key: { type: 'string' },
    data: { type: 'object' },
    tag: { type: 'array', items: { type: 'string' } },
    ref: { type: 'array', items: { type: 'string' } },
    media: { type: 'array', items: { type: 'string' } },
    markdown: { type: 'string' },
    nextReview: { type: 'string', format: 'date-time' },
    srsLevel: { type: 'integer' },
    stat: { type: 'object' }
  }
}

export type DateString = string

export interface IDbUser {
  email?: string
  secret: string
  createdAt: DateString
}

export interface IDbCard {
  userId: string
  data: Record<string, string>
  markdown: string
  createdAt: DateString
  tag: string[]
  ref: Record<string, any>
  media: Record<string, any>
  quizId?: string
}

export interface IDbQuiz {
  srsLevel: number
  nextReview: DateString
  stat: {
    streak: {
      right: number
      wrong: number
      maxRight: number
      maxWrong: number
    }
    lastRight?: DateString
    lastWrong?: DateString
  }
}

export interface IDbLesson {
  name: string
  description: string
  createdAt: DateString
}

export interface IDbDeck {
  name: string
  lessonId: string
  cardIds: string[]
}
