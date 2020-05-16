import { DeepPartial } from '../util'

/**
 * @minLength 1
 */
export type NonEmptyArray<T = any> = Array<T>
/**
 * @minimum 0
 * @TJS-type integer
 */
export type NonNegInt = number
/**
 * Timestamp, based on new Date().toISOString()
 * @format date-time
 */
export type Timestamp = string
/**
 * @pattern ^[A-Za-z0-9_-]+$
 */
export type Key = string
/**
 * @additionalProperties true
 */
export type Datamap = Record<string, any>

export interface DbStat {
  streak: {
    right: NonNegInt
    wrong: NonNegInt
    maxRight: NonNegInt
    maxWrong: NonNegInt
  }
  lastRight?: Timestamp
  lastWrong?: Timestamp
}

export interface QueryItem {
  uid: string
  key: Key
  markdown?: string
  data?: Datamap
  tag?: string[]
  ref?: Key[]
  media?: Key[]
  lesson?: string
  deck?: string
  nextReview?: Timestamp
  srsLevel?: NonNegInt
  stat?: DbStat
}

export type QueryItemPartial = Partial<QueryItem>

export type OnConflict = 'ignore' | 'overwrite' | undefined

export interface CardQuizItem {
  key: Key
  markdown?: string
  data?: Datamap
  tag?: string[]
  ref?: Key[]
  media?: Key[]
  nextReview?: Timestamp
  srsLevel?: NonNegInt
  stat?: DbStat
}

export type InsertCardQuizItem = CardQuizItem & {
  onConflict?: OnConflict
}

export interface LessonDeckItem {
  lessonKey?: string
  lesson?: string
  lessonDescription?: string
  deck?: string
}

export type InsertLessonDeckItem = LessonDeckItem & {
  onConflict?: OnConflict
  cardIds: string[]
}

export type InsertItem = CardQuizItem & LessonDeckItem & {
  onConflict?: OnConflict
}

export type UpdateItem = DeepPartial<CardQuizItem & LessonDeckItem>

export interface RenderItemMin {
  key: string
  data?: Datamap
  ref?: string[]
  media?: string[]
  markdown?: string
}
