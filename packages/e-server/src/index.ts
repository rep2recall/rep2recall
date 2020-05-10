import path from 'path'

import fastify from 'fastify'
import fastifyStatic from 'fastify-static'
import helmet from 'fastify-helmet'

import router from './router'
import { PORT, mediaPath } from './config'

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
  app.register((f, _, next) => {
    f.register(fastifyStatic, {
      root: mediaPath
    })
    next()
  }, { prefix: '/media' })

  app.register(fastifyStatic, {
    root: path.resolve(__dirname, '..')
  })

  app.setNotFoundHandler((_, reply) => {
    reply.sendFile('index.html')
  })

  app.listen(PORT, (err) => {
    if (err) {
      throw err
    }

    console.log(`Go to http://localhost:${PORT}`)
  })
})().catch(console.error)
