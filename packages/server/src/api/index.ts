import { FastifyInstance } from 'fastify'
import fCoookie from 'fastify-cookie'
import swagger from 'fastify-oas'
import fSession from 'fastify-session'
import admin from 'firebase-admin'

import { DbUserModel } from '../db/model'
import editRouter from './edit'
import quizRouter from './quiz'
import userRouter from './user'

const router = (f: FastifyInstance, _: any, next: () => void) => {
  let isFirebase = false

  if (process.env.FIREBASE_SDK && process.env.FIREBASE_CONFIG) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SDK)),
      databaseURL: JSON.parse(process.env.FIREBASE_CONFIG).databaseURL
    })

    isFirebase = true
  }

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
          url: process.env.BASE_URL,
          description: 'Online server'
        },
        ...(process.env.NODE_ENV === 'development'
          ? [
              {
                url: `http://localhost:${process.env.PORT}`,
                description: 'Local server'
              }
            ]
          : [])
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer'
          }
        }
      }
    },
    exposeRoute: true
  })

  f.register(fCoookie)
  f.register(fSession, { secret: process.env.SECRET! })

  f.addHook('preHandler', async (req, reply) => {
    if (req.req.url && req.req.url.startsWith('/api/doc')) {
      return
    }

    if (process.env.DEFAULT_USER) {
      req.session.user = await DbUserModel.signInOrCreate(
        process.env.DEFAULT_USER
      )
      return
    }

    const bearerAuth = async (auth: string) => {
      if (!isFirebase) {
        return false
      }

      const m = /^Bearer (.+)$/.exec(auth)

      if (!m) {
        return false
      }

      const ticket = await admin.auth().verifyIdToken(m[1], true)

      if (!req.session.user && ticket.email) {
        req.session.user = await DbUserModel.signInOrCreate(ticket.email)
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

      req.session.user = await DbUserModel.signInWithSecret(email, secret)

      return !!req.session.user
    }

    if (
      req.headers.authorization &&
      ((await basicAuth(req.headers.authorization)) ||
        (await bearerAuth(req.headers.authorization)))
    ) {
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
