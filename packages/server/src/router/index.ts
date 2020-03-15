import { FastifyInstance } from 'fastify'
import swagger from 'fastify-oas'

import editRouter from './edit'
import mediaRouter from './media'
import quizRouter from './quiz'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
  f.register(swagger, {
    routePrefix: '/doc',
    swagger: {
      info: {
        title: 'Swagger API',
        description: 'Rep2Recall Swagger API',
        version: '0.1.0',
      },
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'media', description: 'Media related endpoints' },
        { name: 'post', description: 'Post related endpoints' },
        { name: 'comment', description: 'Comment related endpoints' },
      ],
      components: {
        securitySchemes: {
          BasicAuth: {
            type: 'http',
            scheme: 'basic',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
    },
    exposeRoute: true,
  })

  f.register(editRouter, { prefix: '/edit' })
  f.register(mediaRouter, { prefix: '/media' })
  f.register(quizRouter, { prefix: '/quiz' })
  next()
}

export default router
