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
 * @properties.__className = Date
 * @additionalProperties true
 */
export type DateSerializable = Date
/**
 * @pattern ^[A-Za-z0-9_-]+$
 */
export type Key = string
/**
 * @additionalProperties true
 */
export type DataMap = Record<string, any>

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
  key: Key
  markdown?: string
  data?: DataMap
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
  data?: DataMap
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
  key: Key
  data?: DataMap
  ref?: Key[]
  media?: string[]
  markdown?: string
}

export interface DbCard {
  uid: string
  created: Timestamp | DateSerializable
  updated?: Timestamp | DateSerializable
  sync?: Timestamp | DateSerializable
  key: Key
  markdown?: string
  data?: DataMap
  media: string[]
  ref: Key[]
  tag: string[]
}

export interface DbDeck {
  uid: string
  created: Timestamp | DateSerializable
  updated?: Timestamp | DateSerializable
  sync?: Timestamp | DateSerializable
  name: string
  lessonId: string
  card: Key[]
}

export interface DbMedia {
  uid: string
  created: Timestamp | DateSerializable
  updated?: Timestamp | DateSerializable
  sync?: Timestamp | DateSerializable
  name: string
  mimetype?: string
  data?: Buffer
  meta?: Record<string, any>
}

export interface DbQuiz {
  uid: string
  created: Timestamp | DateSerializable
  updated?: Timestamp | DateSerializable
  sync?: Timestamp | DateSerializable
  cardId?: string
  srsLevel: NonNegInt
  nextReview: Timestamp
  stat: DbStat
}

export interface DbLesson {
  uid: string
  created: Timestamp | DateSerializable
  updated?: Timestamp | DateSerializable
  sync?: Timestamp | DateSerializable
  key: Key
  name: string
  description?: string
}
