import { FastifyInstance } from 'fastify'
import swagger from 'fastify-oas'
import cors from 'fastify-cors'

import { PORT, g, db } from '../config'
import editRouter from './edit'
import userRouter from './user'
import quizRouter from './quiz'
import mediaRouter from './media'
import fileRouter from './file'

const router = (f: FastifyInstance, _: any, next: () => void) => {
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
          url: `http://localhost:${PORT}`,
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

  f.addHook('preHandler', async (req) => {
    if (req.req.url && req.req.url.startsWith('/api/doc')) {
      return
    }

    const basicAuth = (auth: string) => {
      const m = /^Basic (.+)$/.exec(auth)

      if (!m) {
        return false
      }

      const credentials = Buffer.from(m[1], 'base64').toString()
      const [email, secret] = credentials.split(':')
      if (!secret) {
        return false
      }

      g.userId = db.signInWithSecret(email, secret)!

      return !!g.userId
    }

    if (basicAuth(req.headers.authorization)) {
      return
    }

    g.userId = db.signInOrCreate(process.env.DEFAULT_USER)
  })

  f.register(cors)

  f.register(editRouter, { prefix: '/edit' })
  f.register(quizRouter, { prefix: '/quiz' })
  f.register(userRouter, { prefix: '/user' })
  f.register(mediaRouter, { prefix: '/media' })
  f.register(fileRouter, { prefix: '/file' })

  next()
}

export default router
