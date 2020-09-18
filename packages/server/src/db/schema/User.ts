import crypto from 'crypto'

import { Collection, Entity, ManyToMany, MikroORM, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { Ulid } from 'id128'

import { Note } from './Note'
// import { Quiz } from './Quiz'
import { Template } from './Template'

export interface IUser {
  name: string
  email: string
}

@Entity()
export class User implements IUser {
  @PrimaryKey()
  _id: string = Ulid.generate().toCanonical()

  @Property({ nullable: false })
  name!: string

  @Property({ nullable: false })
  @Unique()
  email!: string

  @Property({ nullable: false, lazy: true })
  apiKey: string = crypto.randomBytes(64).toString('base64').slice(0, -2)

  @ManyToMany({ entity: () => Note, inversedBy: 'users' })
  notes = new Collection(Note)

  // @OneToMany(() => Quiz, (q) => q.user)
  // quizzes = new Collection(Quiz)

  @ManyToMany({ entity: () => Template, inversedBy: 'users' })
  templates = new Collection(Template)

  constructor (d: IUser) {
    Object.assign(this, d)
  }

  purgeOne (orm: MikroORM): void {
    this.notes.removeAll()
    // this.quizzes.removeAll()
    this.templates.removeAll()

    orm.em.remove(this)
  }
}
