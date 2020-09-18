import { Collection, Entity, ManyToMany, OneToMany, PrimaryKey } from '@mikro-orm/core'
import { Ulid } from 'id128'

import { NoteAttr } from './NoteAttr'
import { User } from './User'

@Entity()
export class Note {
  @PrimaryKey()
  _id: string = Ulid.generate().toCanonical()

  @OneToMany(() => NoteAttr, (attr) => attr.note)
  attrs = new Collection<NoteAttr>(this)

  @ManyToMany({ entity: () => User, mappedBy: 'notes' })
  users = new Collection<User>(this)
}
