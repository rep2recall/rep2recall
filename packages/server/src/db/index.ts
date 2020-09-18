import fs from 'fs'
import path from 'path'

import { MikroORM, Options } from '@mikro-orm/core'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'

export async function initDatabase (dbString: string): Promise<MikroORM> {
  const type = /:\/\//.test(dbString)
    ? /^mongodb(\+[A-Z]+)?:\/\//i.test(dbString)
      ? 'mongo'
      : undefined
    : 'sqlite'

  const opts: Options = {
    type,
    entities: ['./dist/db/schema'],
    entitiesTs: ['./src/db/schema'],
    metadataProvider: TsMorphMetadataProvider,
    cache: {
      pretty: true,
      options: {
        cacheDir: process.env.TMP_DIR || './tmp'
      }
    },
    dbName: type === 'sqlite' ? dbString : 'rep2recall',
    clientUrl: type === 'sqlite' ? undefined : dbString
  }

  if (type === 'mongo') {
    opts.ensureIndexes = true
  }

  const isExists = type === 'sqlite' ? fs.existsSync(dbString) : true
  const orm = await MikroORM.init(opts)

  if (type === 'sqlite') {
    if (!isExists) {
      const gen = orm.getSchemaGenerator()
      // console.log(await gen.getCreateSchemaSQL())
      await gen
        .execute(
          fs.readFileSync(path.resolve(__dirname, 'schema/sqlite.sql'), 'utf8')
            .replace(/\n/g, ' ')
            .replace(/;/g, ';\n')
        )
    }
  }

  return orm
}
