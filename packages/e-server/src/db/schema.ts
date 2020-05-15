import * as z from 'zod'

export const zNonNeg = z.number().refine((i) => Number.isInteger(i) && i >= 0, 'not non-negative integer')
export const zTimestamp = zNonNeg
export const zValidSqliteJsonKey = z.string().refine((s) => /[^A-Z0-9_-]/i.test(s), 'Invalid SQLite JSON key')

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
  uid: z.string().optional(),
  key: z.string().optional(),
  markdown: z.string().optional(),
  data: z.record(z.any()).optional(),
  tag: z.array(zValidSqliteJsonKey).optional(),
  ref: z.record(z.any()).optional(),
  media: z.record(z.any()).optional(),
  lesson: z.string().optional(),
  deck: z.string().optional(),
  nextReview: z.date().optional(),
  srsLevel: zNonNeg.optional(),
  stat: zDbStat.deepPartial().optional()
})

// const zOnConflict = z.union([z.literal('ignore'), z.literal('overwrite')]).optional()
const zOnConflict = z.string().refine(
  (s) => ['ignore', 'overwrite'].includes(s),
  'Invalid keyword'
).optional()

export const zInsertCardQuizItem = z.object({
  onConflict: zOnConflict,
  key: zValidSqliteJsonKey.optional(),
  markdown: z.string().optional(),
  data: z.record(z.any()).optional(),
  tag: z.array(zValidSqliteJsonKey).optional(),
  ref: z.record(z.any()).optional(),
  media: z.record(z.any()).optional(),
  srsLevel: z.number().optional(),
  nextReview: zTimestamp.optional(),
  stat: zDbStat.optional()
})

export const zInsertLessonDeckItem = z.object({
  onConflict: zOnConflict,
  lessonId: z.string().optional(),
  lessonName: z.string().optional(),
  lessonDescription: z.string().optional(),
  deck: z.string().optional(),
  cardIds: z.array(zValidSqliteJsonKey).optional()
})
