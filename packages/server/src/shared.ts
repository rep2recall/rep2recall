import { MikroORM } from '@mikro-orm/core'

class G {
  orm!: MikroORM
}

export const g = new G()
