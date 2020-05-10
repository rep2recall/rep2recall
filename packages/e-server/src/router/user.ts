import { FastifyInstance } from 'fastify'

import { db } from '../config'

const router = (f: FastifyInstance, _: any, next: () => void) => {
  f.get('/', {
    schema: {
      tags: ['user'],
      summary: 'Get user information',
      response: {
        200: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            secret: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return db.getUser()
  })

  f.patch('/secret', {
    schema: {
      tags: ['user'],
      summary: 'Reset API key',
      response: {
        200: {
          type: 'object',
          properties: {
            secret: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return {
      secret: db.newSecret()
    }
  })

  f.delete('/logout', {
    schema: {
      tags: ['user'],
      summary: 'Sign out and delete the session'
    }
  }, (_, reply) => {
    reply.status(201).send()
  })

  next()
}

export default router
