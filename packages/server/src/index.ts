import path from 'path'

import fastify from 'fastify'
import helmet from 'fastify-helmet'
import fastifyStatic from 'fastify-static'
import mongoose from 'mongoose'

import apiRouter from './api'
import { logger } from './logger'

async function main() {
  await mongoose.connect(process.env.MONGO_URI!, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
  })

  const app = fastify({ logger })
  const port = parseInt(process.env.PORT || '8080')

  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: "'self' 'unsafe-inline' 'unsafe-eval'",
        styleSrc:
          "'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        fontSrc: 'https://fonts.gstatic.com https://cdn.jsdelivr.net'
      }
    }
  })

  app.register(fastifyStatic, {
    root: path.resolve('public')
  })

  app.register(apiRouter, { prefix: '/api' })

  app.setNotFoundHandler((_, reply) => {
    reply.sendFile('index.html')
  })

  app.listen(
    port,
    process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0',
    (err) => {
      if (err) {
        throw err
      }

      console.error(`Go to http://localhost:${port}`)
    }
  )
}

if (require.main === module) {
  main().catch(console.error)
}
