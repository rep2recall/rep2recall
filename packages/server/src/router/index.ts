import { FastifyInstance } from 'fastify'
import swagger from 'fastify-oas'
import fSession from 'fastify-session'
import fCoookie from 'fastify-cookie'
import admin from 'firebase-admin'

import editRouter from './edit'
import quizRouter from './quiz'
import { db } from '../db/schema'

admin.initializeApp({
  credential: admin.credential.cert(require('../../firebase-key.json')),
  databaseURL: 'https://rep2recall.firebaseio.com',
})

const router = (f: FastifyInstance, opts: any, next: () => void) => {
  f.register(swagger, {
    routePrefix: '/doc',
    swagger: {
      info: {
        title: 'Rep2Recall API',
        description: 'Rep2Recall Swagger API',
        version: '0.1.0',
      },
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'edit', description: 'Editing related endpoints' },
        { name: 'quiz', description: 'Quizzing related endpoints' },
      ],
      components: {
        securitySchemes: {
          BasicAuth: {
            type: 'http',
            scheme: 'basic',
          },
        },
      },
    },
    exposeRoute: true,
  })

  f.register(fCoookie)
  f.register(fSession, { secret: process.env.SECRET! })

  f.addHook('preHandler', (req, reply, done) => {
    if (req.req.url && req.req.url.startsWith('/api/doc')) {
      return done()
    }

    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')

    if (!m) {
      return done(new Error('Bearer token not specified.'))
    }

    admin.auth().verifyIdToken(m[1], true)
      .then(async (ticket) => {
        try {
          req.session.user = ticket
          if (!db.user) {
            await db.signIn(ticket.email)
          }

          done()
        } catch (e) {
          done(e)
        }
      })
      .catch(done)
  })

  f.register(editRouter, { prefix: '/edit' })
  f.register(quizRouter, { prefix: '/quiz' })
  next()
}

export default router
