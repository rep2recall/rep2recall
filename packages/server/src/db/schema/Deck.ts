import { Entity, PrimaryKey, Property, Type, Unique } from '@mikro-orm/core'
import { Ulid } from 'id128'

class DeckNameType extends Type<string[], string> {
  convertToDatabaseValue (vs: string[]) {
    return vs.join('\x1f')
  }

  convertToJSValue (s: string) {
    // eslint-disable-next-line no-control-regex
    return s.split(/\x1f/g)
  }

  getColumnType () {
    return 'TEXT'
  }
}

export interface IDeck {
  name: string[]
}

@Entity()
export class Deck implements IDeck {
  @PrimaryKey()
  _id: string = Ulid.generate().toCanonical()

  @Property({ type: DeckNameType, nullable: false })
  @Unique()
  name!: string[]

  constructor (d: IDeck) {
    Object.assign(this, d)
  }
}
