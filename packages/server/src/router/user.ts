import { FastifyInstance } from 'fastify'

export default (f: FastifyInstance, _: any, next: () => void) => {
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

  next()
}
