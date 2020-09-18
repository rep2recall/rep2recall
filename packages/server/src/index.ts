import path from 'path'

import fastify from 'fastify'
import helmet from 'fastify-helmet'
import fStatic from 'fastify-static'

import { initDatabase } from './db'
import { Note } from './db/schema/Note'
import { NoteAttr } from './db/schema/NoteAttr'
import { Quiz } from './db/schema/Quiz'
import { Template } from './db/schema/Template'
import { User } from './db/schema/User'
import { logger } from './logger'
import { g } from './shared'
import { filterObjValue, ser } from './util/serialize'

const app = fastify({
  logger
})

const port = parseInt(process.env.PORT || '8080')

app.register(helmet)

app.addHook('preHandler', async (req) => {
  if (req.body && typeof req.body === 'object') {
    req.log.info(
      {
        body: filterObjValue(
          req.body,
          /**
           * This will keep only primitives, nulls, plain objects, Date, and RegExp
           * ArrayBuffer in file uploads will be removed.
           */
          (v) => ser.hash(v) === ser.hash(ser.clone(v))
        )
      },
      'parsed body'
    )
  }
})

app.register(fStatic, {
  root: path.resolve('public')
})

app.setNotFoundHandler((_, reply) => {
  reply.sendFile('index.html')
})

let isRunning = false

;(async () => {
  if (process.versions.electron) {
    return new Promise<string>((resolve) => {
      process.on('message', () => {
        if (!isRunning) {
          resolve('electron')
        }

        isRunning = true
      })
    })
  }

  return process.env.NODE_ENV || 'production'
})()
  .then(async (NODE_ENV) => {
    g.orm = await initDatabase(process.env.MONGO_URI || process.env.DB || 'rep2recall.db')
    const user = new User({ email: '', name: '' })
    g.orm.em.persist(user)

    const note = new Note()
    g.orm.em.persist(note)

    const noteAttr = new NoteAttr({ note, key: '', value: '' })
    g.orm.em.persist(noteAttr)

    const template = new Template({ name: 'hello', front: '', back: '' })
    g.orm.em.persist(template)

    const quiz = new Quiz({ user, note, template, front: '', back: '', mnemonic: '' })
    g.orm.em.persist(quiz)

    await g.orm.em.flush()

    app.listen(
      port,
      NODE_ENV === 'production' ? '0.0.0.0' : 'localhost',
      (err) => {
        if (err) {
          throw err
        }

        logger.info(`Go to http://localhost:${port}`)
      }
    )
  })
