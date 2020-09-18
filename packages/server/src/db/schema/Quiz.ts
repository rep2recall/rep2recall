import { Entity, EntityProperty, Index, ManyToOne, PrimaryKey, Property, Type, Unique } from '@mikro-orm/core'
import dayjs from 'dayjs'
import { Ulid } from 'id128'

import { getNextReview, repeatReview, srsMap } from '../quiz'
import { Note } from './Note'
import { Template } from './Template'
import { User } from './User'

export class DateTimeType extends Type<Date, string> {
  convertToDatabaseValue (value: Date | string): string {
    return dayjs(value).toISOString()
  }

  convertToJSValue (value: Date | string): Date {
    return dayjs(value).toDate()
  }

  getColumnType (prop: EntityProperty): string {
    return prop.length ? `DATE(${prop.length})` : 'DATE'
  }
}

export interface IQuiz {
  user: User
  note: Note
  template: Template
  front?: string
  back?: string
  mnemonic?: string
}

@Entity()
@Unique({ properties: ['user', 'note', 'template'] })
export class Quiz implements IQuiz {
  /*
   * Base Properties
   */

  @PrimaryKey()
  _id: string = Ulid.generate().toCanonical()

  @ManyToOne({ nullable: false })
  user!: User

  @ManyToOne({ nullable: false })
  note!: Note

  @ManyToOne({ nullable: false })
  template!: Template

  @Property({ lazy: true })
  front?: string

  @Property({ lazy: true })
  back?: string

  @Property({ lazy: true })
  mnemonic?: string

  /*
   * Quiz Properties
   */

  @Property()
  @Index()
  srsLevel?: number

  @Property({ type: DateTimeType })
  @Index()
  nextReview?: Date

  @Property()
  rightStreak?: number

  @Property()
  @Index()
  wrongStreak?: number

  @Property()
  maxRight?: number

  @Property()
  @Index()
  maxWrong?: number

  @Property({ type: DateTimeType })
  lastRight?: Date

  @Property({ type: DateTimeType })
  @Index()
  lastWrong?: Date

  constructor (d: IQuiz) {
    Object.assign(this, d)
  }

  markRight (): void {
    return this._updateSrsLevel(+1)()
  }

  markWrong (): void {
    return this._updateSrsLevel(-1)()
  }

  markRepeat (): void {
    return this._updateSrsLevel(0)()
  }

  private _updateSrsLevel (dSrsLevel: number) {
    return () => {
      this.rightStreak = this.rightStreak || 0
      this.wrongStreak = this.wrongStreak || 0
      this.maxRight = this.maxRight || 0
      this.maxWrong = this.maxWrong || 0

      if (dSrsLevel > 0) {
        this.rightStreak = this.rightStreak + 1
        this.wrongStreak = 0
        this.lastRight = new Date()

        if (this.rightStreak > this.maxRight) {
          this.maxRight = this.rightStreak
        }
      } else if (dSrsLevel < 0) {
        this.wrongStreak = this.wrongStreak + 1
        this.rightStreak = 0
        this.lastWrong = new Date()

        if (this.wrongStreak > this.maxWrong) {
          this.maxWrong = this.wrongStreak
        }
      }

      this.srsLevel = this.srsLevel || 0

      this.srsLevel += dSrsLevel

      if (this.srsLevel >= srsMap.length) {
        this.srsLevel = srsMap.length - 1
      }

      if (this.srsLevel < 0) {
        this.srsLevel = 0
      }

      if (dSrsLevel > 0) {
        this.nextReview = getNextReview(this.srsLevel)
      } else {
        this.nextReview = repeatReview()
      }
    }
  }
}
