import { FastifyInstance } from 'fastify'

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
  }, async (req) => {
    const { user } = req.session
    return user
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
  }, async (req) => {
    const { user } = req.session
    user.newSecret()
    user.save()

    return {
      secret: user.secret
    }
  })

  f.delete('/logout', {
    schema: {
      tags: ['user'],
      summary: 'Sign out and delete the session'
    }
  }, (req, reply) => {
    req.destroySession((err) => {
      err ? reply.status(400).send() : reply.status(201).send()
    })
  })

  next()
}

export default router
