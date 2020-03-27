import { Entity, primary, prop, Table } from 'liteorm'
import nanoid from 'nanoid'

@Entity({ name: 'quiz' })
export class LocalQuiz {
  @primary({ default: () => nanoid() }) _id?: string
  @prop() nextReview!: Date
  @prop() stat!: {
    streak: {
      right: number
      wrong: number
      maxRight: number
      maxWrong: number
    }
  }
}

export const LocalQuizModel = new Table(LocalQuiz)

@Entity({ name: 'card' })
export class LocalCard {
  /**
   * Filename and deck
   */
  @prop({ unique: true }) slug!: string
  @prop() deck!: string

  /**
   * Frontmatter
   */
  @prop({ unique: true, null: true }) h?: string
  @prop({ null: true }) data?: Record<string, any>
  @prop({ type: 'StringArray', null: true }) tag?: string[]
  @prop({ type: 'StringArray', null: true }) ref?: string[] // Self-reference
  @prop({ type: 'StringArray', null: true }) media?: string[] // GridFS-reference

  /**
   * Content
   */
  @prop({ null: true }) markdown?: string

  /**
   * Quiz
   */
  @prop({ references: LocalQuizModel, null: true }) quizId!: string
}

export const LocalCardModel = new Table(LocalCard)

@Entity({ name: 'media' })
export class LocalMedia {
  @prop({ unique: true }) filename!: string
  @prop() data!: ArrayBuffer
  @prop() meta?: Record<string, any>
}

export const LocalMediaModel = new Table(LocalMedia)
