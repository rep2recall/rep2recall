import { FastifyInstance } from 'fastify'
import swagger from 'fastify-oas'
import fSession from 'fastify-session'
import fCoookie from 'fastify-cookie'
import admin from 'firebase-admin'

import editRouter from './edit'
import quizRouter from './quiz'
import userRouter from './user'
import { Db } from '../db/schema'

const router = (f: FastifyInstance, _: any, next: () => void) => {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SDK!)),
    databaseURL: 'https://rep2recall.firebaseio.com'
  })

  f.register(swagger, {
    routePrefix: '/doc',
    swagger: {
      info: {
        title: 'Rep2Recall API',
        description: 'Rep2Recall Swagger API',
        version: '0.1.0'
      },
      consumes: ['application/json'],
      produces: ['application/json'],
      servers: [
        {
          url: 'https://rep2recall.herokuapp.com',
          description: 'Online server'
        },
        {
          url: 'http://localhost:8080',
          description: 'Local server'
        }
      ],
      components: {
        securitySchemes: {
          BasicAuth: {
            type: 'http',
            scheme: 'basic'
          }
          // BearerAuth: {
          //   type: 'http',
          //   scheme: 'bearer'
          // }
        }
      }
    },
    exposeRoute: true
  })

  f.register(fCoookie)
  f.register(fSession, { secret: process.env.SECRET! })

  f.addHook('preHandler', async (req, reply) => {
    // if (process.env.NODE_ENV === 'development' && process.env.DEFAULT_USER) {
    //   req.session.user = await Db.signInOrCreate(process.env.DEFAULT_USER)
    //   return
    // }

    if (req.req.url && req.req.url.startsWith('/api/doc')) {
      return
    }

    const bearerAuth = async (auth: string) => {
      const m = /^Bearer (.+)$/.exec(auth)

      if (!m) {
        return false
      }

      const ticket = await admin.auth().verifyIdToken(m[1], true)

      if (!req.session.user && ticket.email) {
        req.session.user = await Db.signInOrCreate(ticket.email)
      }

      return !!req.session.user
    }

    const basicAuth = async (auth: string) => {
      const m = /^Basic (.+)$/.exec(auth)

      if (!m) {
        return false
      }

      const credentials = Buffer.from(m[1], 'base64').toString()
      const [email, secret] = credentials.split(':')
      if (!secret) {
        return false
      }

      req.session.user = await Db.signInWithSecret(email, secret)

      return !!req.session.user
    }

    if (await bearerAuth(req.headers.authorization) || await basicAuth(req.headers.authorization)) {
      return
    }

    reply.status(401).send()
  })

  f.register(editRouter, { prefix: '/edit' })
  f.register(quizRouter, { prefix: '/quiz' })
  f.register(userRouter, { prefix: '/user' })
  next()
}

export default router
