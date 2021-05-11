import crypto from 'crypto'

import MongoStore from 'connect-mongo'
import { FastifyInstance } from 'fastify'
import fCookie from 'fastify-cookie'
import fSession from 'fastify-session'
import swagger from 'fastify-swagger'

import { UserModel } from '../db/mongo'
import { logger } from '../logger'
import { magic, ser } from '../shared'
import noteRouter from './note'
import presetRouter from './preset'
import quizRouter from './quiz'
import userRouter from './user'
import { filterObjValue } from './util'

const apiRouter = (f: FastifyInstance, _: unknown, next: () => void) => {
  if (process.env.NODE_ENV === 'development') {
    f.register(require('fastify-cors'))
  }

  if (!magic) {
    process.env.DEFAULT_USER = process.env.DEFAULT_USER || 'DEFAULT'
  }

  f.register(fCookie)

  if (process.env.SECRET) {
    f.register(fSession, {
      secret: process.env.SECRET,
      store: process.env.MONGO_URI
        ? MongoStore.create({
            mongoUrl: process.env.MONGO_URI
          })
        : undefined
    })
  } else {
    if (process.env.MONGO_URI) {
      logger.error('process.env.SECRET is required to store mongo session')
    }

    f.register(fSession, {
      secret: crypto.randomBytes(64).toString('base64')
    })
  }

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
    exposeRoute: true,
    routePrefix: '/doc'
  })

  f.addHook('preHandler', async (req, reply) => {
    if (req.url && req.url.startsWith('/api/doc')) {
      return
    }

    let userId: string | undefined

    if (process.env.DEFAULT_USER) {
      const email = process.env.DEFAULT_USER

      userId = await UserModel.findOne({ email })
        .then(
          (u) =>
            u ||
            UserModel.create({
              email
            })
        )
        .then((u) => u._id)

      req.session.userId = userId
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
      if (!magic) {
        return
      }

      const m = /^Bearer (.+)$/.exec(authorization)

      if (!m) {
        return
      }

      try {
        magic.token.validate(m[1])
      } catch (_) {
        return
      }

      const userId = req.session.userId
      if (userId) {
        return userId
      }

      const ticket = await magic.users.getMetadataByToken(m[1])

      if (ticket.email) {
        const email = ticket.email
        return await UserModel.findOne({ email })
          .then(async (u) => {
            if (u) {
              return u
            }

            return UserModel.create({
              email
            })
          })
          .then((u) => u._id as string)
      }
    }

    userId = (await isBasic()) || (await isBearer())

    if (userId) {
      req.session.userId = userId
      return
    }

    reply.status(401).send({})
  })

  f.get('/settings', async () => {
    return {
      magic: process.env.MAGIC_PUBLIC
    }
  })

  f.register(noteRouter, { prefix: '/note' })
  f.register(presetRouter, { prefix: '/preset' })
  f.register(quizRouter, { prefix: '/quiz' })
  f.register(userRouter, { prefix: '/user' })

  next()
}

export default apiRouter
