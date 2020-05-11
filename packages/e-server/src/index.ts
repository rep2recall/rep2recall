import { Readable } from 'stream'

import fastify from 'fastify'
import helmet from 'fastify-helmet'

import router from './router'
import { PORT, db } from './config'

(async () => {
  const app = fastify({
    logger: {
      prettyPrint: true
    }
  })

  app.register(helmet)

  if (process.env.NODE_ENV === 'development') {
    app.addHook('preHandler', async (req) => {
      if (req.body) {
        req.log.info({ body: req.body }, 'body')
      }
    })
  }

  app.register(router, { prefix: '/api' })

  app.get('/media/:name', (req, reply) => {
    const { mimetype, data } = db.getMedia(req.params.name)
    if (mimetype && data) {
      reply.type(mimetype).send(new Readable({
        read () {
          this.push(data)
        }
      }))
      return
    }

    reply.status(404).send()
  })

  app.listen(PORT, (err) => {
    if (err) {
      throw err
    }

    console.log(`Go to http://localhost:${PORT}`)

    if (process.send) {
      process.send('started')
    }
  })
})().catch(console.error)
