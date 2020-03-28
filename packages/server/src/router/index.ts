import { FastifyInstance } from 'fastify'
import swagger from 'fastify-oas'

import editRouter from './edit'
import quizRouter from './quiz'

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

  f.register(editRouter, { prefix: '/edit' })
  f.register(quizRouter, { prefix: '/quiz' })
  next()
}

export default router
