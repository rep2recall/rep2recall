import * as z from 'zod'

export const zNonNeg = z.number().refine((i) => Number.isInteger(i) && i >= 0, 'not non-negative integer')
export const zTimestamp = zNonNeg

export const zDbStat = z.object({
  streak: z.object({
    right: zNonNeg,
    wrong: zNonNeg,
    maxRight: zNonNeg,
    maxWrong: zNonNeg
  }),
  lastRight: zTimestamp.optional(),
  lastWrong: zTimestamp.optional()
})

export const defaultDbStat: z.infer<typeof zDbStat> = {
  streak: {
    right: 0,
    wrong: 0,
    maxRight: 0,
    maxWrong: 0
  }
}

export const zQueryItem = z.object({
  key: z.string().optional(),
  markdown: z.string().optional(),
  data: z.record(z.any()).optional(),
  tag: z.array(z.string()).optional(),
  ref: z.array(z.string()).optional(),
  media: z.array(z.string()).optional(),
  lesson: z.string().optional(),
  deck: z.string().optional(),
  nextReview: z.date().optional(),
  srsLevel: zNonNeg.optional(),
  stat: zDbStat.deepPartial().optional()
})

const zOnConflict = z.string().refine(
  (s) => ['ignore', 'overwrite'].includes(s),
  'Invalid keyword'
).optional()

const zCardQuizItem = z.object({
  key: z.string().optional(),
  markdown: z.string().optional(),
  data: z.record(z.any()).optional(),
  tag: z.array(z.string()).optional(),
  ref: z.array(z.string()).optional(),
  media: z.array(z.string()).optional(),
  srsLevel: z.number().optional(),
  nextReview: zTimestamp.optional(),
  stat: zDbStat.optional()
})

export const zInsertCardQuizItem = z.object({
  onConflict: zOnConflict,
  ...zCardQuizItem.shape
})

const zLessonDeckItem = z.object({
  lessonKey: z.string().optional(),
  lesson: z.string().optional(),
  lessonDescription: z.string().optional(),
  deck: z.string().optional()
})

export const zInsertLessonDeckItem = z.object({
  onConflict: zOnConflict,
  cardIds: z.array(z.string()).optional(),
  ...zLessonDeckItem.shape
})

export const zInsertItem = z.object({
  onConflict: zOnConflict,
  ...zCardQuizItem.shape,
  // onConflict: zOnConflict, // ON CONFLICT IGNORE
  ...zLessonDeckItem.shape
})

export const zUpdateItem = z.object({
  ...zCardQuizItem.shape,
  ...zLessonDeckItem.shape,
  stat: zDbStat.deepPartial().optional()
})
