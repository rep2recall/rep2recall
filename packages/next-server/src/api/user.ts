import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { UserModel } from '../db/mongo'
import { IError, ISuccess, sSuccess } from '../types'

const userRouter = (f: FastifyInstance, _: unknown, next: () => void) => {
  const tags = ['user']

  getOne()
  update()
  newApiKey()
  signOut()
  deleteOne()

  next()

  /**
   * GET /
   */
  function getOne() {
    const sResponseShape = {
      email: S.string().optional(),
      name: S.string().optional(),
      image: S.string().optional(),
      apiKey: S.string().optional()
    }
    const sResponse = S.shape(sResponseShape)

    const sQuerystring = S.shape({
      select: S.list(S.string().enum(...Object.keys(sResponseShape)))
    })

    f.get<{
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get current User',
          querystring: sQuerystring.valueOf(),
          response: {
            200: sResponse.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        return req.query.select.reduce(
          (prev, c) => ({
            ...prev,
            [c]: (user as Record<string, any>)[c]
          }),
          {} as any
        )
      }
    )
  }

  /**
   * PATCH /
   */
  function update() {
    const sBody = S.shape({
      email: S.string().optional(),
      name: S.string().optional(),
      image: S.string().optional()
    })

    f.patch<{
      Body: typeof sBody.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update current User',
          body: sBody.valueOf(),
          response: {
            201: sSuccess.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        Object.assign(user, req.body)
        await user.save()
        res.status(201)
        return {
          result: 'updated'
        }
      }
    )
  }

  /**
   * PATCH /apiKey
   */
  function newApiKey() {
    f.patch(
      '/apiKey',
      {
        schema: {
          tags,
          summary: 'Generate new API key for current User',
          response: {
            201: sSuccess.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const apiKey = UserModel.newApiKey()
        user.apiKey = apiKey
        await user.save()
        res.status(201)
        return {
          result: apiKey
        }
      }
    )
  }

  /**
   * POST /signOut
   */
  function signOut() {
    f.post(
      '/signOut',
      {
        schema: {
          tags,
          summary: 'Sign out of current User',
          response: {
            201: sSuccess.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        req.session.delete()
        res.status(201)
        return {
          result: 'signed out'
        }
      }
    )
  }

  /**
   * DELETE /
   */
  function deleteOne() {
    f.delete(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete current User and sign out',
          response: {
            201: sSuccess.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        await user.deleteOne()
        req.session.delete()
        res.status(201)
        return {
          result: 'deleted'
        }
      }
    )
  }
}

export default userRouter
