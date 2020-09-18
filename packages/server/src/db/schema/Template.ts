import { Collection, Entity, Index, ManyToMany, PrimaryKey, Property } from '@mikro-orm/core'
import { Ulid } from 'id128'

import { User } from './User'

export interface ITemplate {
  name: string
  description?: string
  front: string
  back?: string
}

@Entity()
export class Template implements ITemplate {
  @PrimaryKey()
  _id: string = Ulid.generate().toCanonical()

  @Property({ nullable: false })
  @Index()
  name!: string

  @Property()
  description?: string

  @Property({ nullable: false, lazy: true })
  front!: string

  @Property({ lazy: true })
  back?: string

  @ManyToMany({ entity: () => User, mappedBy: 'templates' })
  users = new Collection(User)

  constructor (d: ITemplate) {
    Object.assign(this, d)
  }
}
