import path from 'path'

import fastify from 'fastify'
import fastifyStatic from 'fastify-static'

import { config } from './config'
import router from './router'

;(async () => {
  const app = fastify({
    logger: (() => {
      try {
        require.resolve('pino-pretty')
        return {
          prettyPrint: true,
        }
      } catch (_) {}
    })(),
  })
  app.addHook('preHandler', function (req, reply, done) {
    if (req.body) {
      req.log.info({ body: req.body }, 'body')
    }

    done()
  })

  const port = parseInt(process.env.PORT || (config.port || 24000).toString())

  if (process.env.ADMIN) {
    app.register(require('fastify-cors'))
  }

  app.register(router, { prefix: '/api' })

  app.register(fastifyStatic, {
    root: path.join(__dirname, 'public'),
  })

  app.get('*', (req, reply) => {
    reply.sendFile('index.html')
  })

  app.listen(port, (err) => {
    if (err) {
      throw err
    }
  })
})().catch(console.error)
