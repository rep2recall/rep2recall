import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import fastify, { FastifyReply } from 'fastify'
import helmet from 'fastify-helmet'
import fastifyStatic from 'fastify-static'
import handlebars from 'handlebars'
import mongoose from 'mongoose'
import pointOfView from 'point-of-view'

import apiRouter from './api'
import { logger } from './logger'

async function main() {
  await mongoose.connect(process.env.MONGO_URI!, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
  })

  if (!fs.existsSync('session-key')) {
    execSync('./node_modules/.bin/secure-session-gen-key > session-key', {
      stdio: 'inherit'
    })
  }

  const app = fastify({ logger })
  const port = parseInt(process.env.PORT || '8080')
  const jsNonce = crypto.randomBytes(64).toString('base64')

  app.register(helmet, {
    contentSecurityPolicy: false
  })
  app.register(pointOfView, {
    engine: { handlebars }
  })

  const renderTemplate = (reply: FastifyReply) => {
    reply.view('./public/index.html', {
      jsNonce,
      firebaseConfig: process.env.FIREBASE_CONFIG || ''
    })
  }

  app.get('/', (_, reply) => {
    renderTemplate(reply)
  })

  app.register(fastifyStatic, {
    root: path.resolve('public')
  })

  app.register(apiRouter, { prefix: '/api' })

  app.setNotFoundHandler((_, reply) => {
    renderTemplate(reply)
  })

  app.listen(
    port,
    process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0',
    (err) => {
      if (err) {
        throw err
      }

      console.info(`Go to http://localhost:${port}`)
    }
  )
}

if (require.main === module) {
  main().catch(console.error)
}
