import path from 'path'

import fastify from 'fastify'
import fastifyStatic from 'fastify-static'

import { config } from './config'
import router from './router'
import { initDatabase } from './db/schema'

try {
  require('dotenv').config()
} catch (_) {}

(async () => {
  await initDatabase(process.env.MONGO_URI!)

  const app = fastify({
    logger: process.env.NODE_ENV === 'development' ? {
      prettyPrint: true,
    } : true,
  })

  if (process.env.NODE_ENV === 'development') {
    app.addHook('preHandler', function (req, reply, done) {
      if (req.body) {
        req.log.info({ body: req.body }, 'body')
      }

      done()
    })
  }

  const port = parseInt(process.env.PORT || (config.port || 24000).toString())

  app.register(router, { prefix: '/api' })

  app.register(fastifyStatic, {
    root: path.resolve('public'),
  })

  app.get('*', (req, reply) => {
    reply.sendFile('index.html')
  })

  app.listen(port, process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0', (err) => {
    if (err) {
      throw err
    }
  })
})().catch(console.error)
