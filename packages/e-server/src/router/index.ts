import { FastifyInstance } from 'fastify'
import swagger from 'fastify-oas'
import cors from 'fastify-cors'

import { PORT } from '../config'
import editRouter from './edit'
import quizRouter from './quiz'
import mediaRouter from './media'
import fileRouter from './file'
import schema from '../schema/schema.json'

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
        }
      }
    },
    exposeRoute: true
  })

  f.register(cors)
  f.addSchema({
    ...schema,
    $id: 'schema.json'
  })

  f.register(editRouter, { prefix: '/edit' })
  f.register(quizRouter, { prefix: '/quiz' })
  f.register(mediaRouter, { prefix: '/media' })
  f.register(fileRouter, { prefix: '/file' })

  next()
}

export default router
