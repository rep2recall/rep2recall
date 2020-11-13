import fs from 'fs'

import { FastifyInstance } from 'fastify'
import fSession from 'fastify-secure-session'
import swagger from 'fastify-swagger'
import admin from 'firebase-admin'

import { UserModel } from '../db/mongo'
import { ser } from '../shared'
import presetRouter from './preset'
import quizRouter from './quiz'
import { filterObjValue } from './util'

const apiRouter = (f: FastifyInstance, _: unknown, next: () => void) => {
  let isFirebase = false

  if (process.env.FIREBASE_SDK && process.env.FIREBASE_CONFIG) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SDK)),
      databaseURL: JSON.parse(process.env.FIREBASE_CONFIG).databaseURL
    })

    isFirebase = true
  }

  if (process.env.NODE_ENV === 'development') {
    f.register(require('fastify-cors'))
  }

  f.register(fSession, { key: fs.readFileSync('session-key') })

  f.addHook('preHandler', function (req, _, done) {
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
    done()
  })

  f.addHook<{
    Querystring: Record<string, string | string[]>
  }>('preValidation', async (req) => {
    if (typeof req.query.select === 'string') {
      req.query.select = req.query.select.split(/,/g)
    }
  })

  f.register(swagger, {
    routePrefix: '/api/doc',
    swagger: {
      info: {
        title: 'Rep2recall API',
        description: 'Full JavaScript/CSS/HTML customizable quiz',
        version: '0.1.0'
      },
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        basicAuth: {
          type: 'basic'
        },
        apiKey: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header'
        }
      }
    },
    exposeRoute: true
  })

  f.addHook('preHandler', async (req, reply) => {
    if (req.url && req.url.startsWith('/api/doc')) {
      return
    }

    let userId: string | undefined

    if (process.env.DEFAULT_USER) {
      userId = await UserModel.findOne({
        email: process.env.DEFAULT_USER
      }).then((u) => u?._id as string)

      req.session.set('userId', userId)
      return
    }

    const { authorization } = req.headers

    if (!authorization) {
      reply.status(401).send({})
      return
    }

    const isBasic = async () => {
      const m = /^Basic (.+)$/.exec(authorization)

      if (!m) {
        return
      }

      const credentials = Buffer.from(m[1], 'base64').toString()
      const [email, apiKey] = credentials.split(':')
      if (!apiKey) {
        return false
      }

      return UserModel.findOne({
        email,
        apiKey
      }).then((u) => u?._id)
    }

    const isBearer = async () => {
      if (!isFirebase) {
        return
      }

      const m = /^Bearer (.+)$/.exec(authorization)

      if (!m) {
        return
      }

      const ticket = await admin.auth().verifyIdToken(m[1], true)
      const user = req.session.get('user')

      if (ticket.email && (!user || user.email !== ticket.email)) {
        const email = ticket.email
        return await UserModel.findOne({ email })
          .then((u) => {
            if (u) {
              return u
            }

            return UserModel.create({
              email,
              name: ticket.name,
              image: ticket.picture || 'https://www.gravatar.com/avatar/0?d=mp'
            })
          })
          .then((u) => u._id as string)
      }
    }

    userId = (await isBasic()) || (await isBearer())

    if (userId) {
      req.session.set('userId', userId)
      return
    }

    reply.status(401).send({})
  })

  f.register(presetRouter, { prefix: '/preset' })
  f.register(quizRouter, { prefix: '/quiz' })

  next()
}

export default apiRouter
