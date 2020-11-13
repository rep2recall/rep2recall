import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { PresetModel, UserModel } from '../db/mongo'
import { IError, ISuccess, sError, sStatus, sSuccess } from '../types'

const presetRouter = (f: FastifyInstance, _: any, next: () => void) => {
  getOne()
  getAll()
  create()
  update()
  deleteOne()

  next()

  /**
   * GET /
   */
  function getOne() {
    const sQuerystring = S.shape({
      select: S.list(S.string()),
      id: S.string()
    })

    const sResponse = S.shape({
      id: S.string().optional(),
      name: S.string().optional(),
      q: S.string().optional(),
      status: sStatus.optional(),
      selected: S.list(S.string()).optional(),
      opened: S.list(S.string()).optional()
    })

    f.get<{
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          querystring: sQuerystring.valueOf(),
          response: {
            200: sResponse.valueOf(),
            401: sError.valueOf(),
            404: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'user not found'
          }
        }

        return PresetModel.findOne({
          _id: req.query.id,
          user
        }).then((r) =>
          r
            ? req.query.select.reduce(
                (prev, c) => ({
                  ...prev,
                  [c]: (r as Record<string, any>)[c]
                }),
                {} as Record<string, any>
              )
            : {
                error: 'not found'
              }
        )
      }
    )
  }

  /**
   * GET /all
   */
  function getAll() {
    const sResponse = S.shape({
      result: S.list(
        S.shape({
          id: S.string(),
          name: S.string(),
          q: S.string(),
          status: sStatus,
          selected: S.list(S.string()),
          opened: S.list(S.string())
        })
      )
    })

    f.get(
      '/all',
      {
        schema: {
          response: {
            200: sResponse.valueOf(),
            401: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'user not found'
          }
        }

        return {
          result: await PresetModel.find({ user })
            .sort('-updatedAt -createdAt')
            .then((rs) =>
              rs.map((r) => ({
                id: r._id,
                name: r.name,
                q: r.q,
                status: r.status,
                selected: r.selected,
                opened: r.opened
              }))
            )
        }
      }
    )
  }

  /**
   * PUT /
   */
  function create() {
    const sBody = S.shape({
      name: S.string(),
      q: S.string(),
      status: sStatus,
      selected: S.list(S.string()),
      opened: S.list(S.string())
    })

    const sResponse = S.shape({
      id: S.string()
    })

    f.put<{
      Body: typeof sBody.type
    }>(
      '/',
      {
        schema: {
          body: sBody.valueOf(),
          response: {
            201: sResponse.valueOf(),
            401: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'user not found'
          }
        }

        const p = await PresetModel.create({
          ...req.body,
          user
        })

        res.status(201)
        return {
          id: p._id
        }
      }
    )
  }

  /**
   * PATCH /
   */
  function update() {
    const sBody = S.shape({
      name: S.string().optional(),
      q: S.string().optional(),
      status: sStatus.optional(),
      selected: S.list(S.string()).optional(),
      opened: S.list(S.string()).optional()
    })

    const sQuerystring = S.shape({
      id: S.string()
    })

    f.patch<{
      Body: typeof sBody.type
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          body: sBody.valueOf(),
          querystring: sQuerystring.valueOf(),
          response: {
            201: sSuccess.valueOf(),
            401: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const user = await UserModel.findById(req.session.get('userId'))
        if (!user) {
          res.status(401)
          return {
            error: 'user not found'
          }
        }
        await PresetModel.updateOne(
          {
            user,
            _id: req.query.id
          },
          {
            $set: req.body
          }
        )

        res.status(201)
        return {
          result: 'created'
        }
      }
    )
  }

  /**
   * DELETE /
   */
  function deleteOne() {
    const sQuerystring = S.shape({
      id: S.string()
    })

    f.delete<{
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          querystring: sQuerystring.valueOf(),
          response: {
            201: sSuccess.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess> => {
        await PresetModel.deleteOne({
          _id: req.query.id
        })

        res.status(201)
        return {
          result: 'deleted'
        }
      }
    )
  }
}

export default presetRouter
