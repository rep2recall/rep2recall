import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { PresetModel } from '../db/mongo'
import { IError, ISuccess, sStatus, sSuccess } from '../types'

const presetRouter = (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['preset']

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
    const sResponseShape = {
      id: S.string().optional(),
      name: S.string().optional(),
      q: S.string().optional(),
      status: sStatus.optional(),
      selected: S.list(S.string()).optional(),
      opened: S.list(S.string()).optional()
    }
    const sResponse = S.shape(sResponseShape)

    const sQuerystring = S.shape({
      select: S.list(S.string().enum(...Object.keys(sResponseShape))),
      id: S.string().optional()
    })

    f.get<{
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get a Preset',
          querystring: sQuerystring.valueOf(),
          response: {
            200: sResponse.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const userId: string = req.session.get('userId')
        if (!userId) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        return PresetModel.findOne({
          userId,
          _id: req.query.id || ''
        }).then((r) => {
          if (r) {
            return req.query.select.reduce(
              (prev, c) => ({
                ...prev,
                [c]: (r as Record<string, any>)[c]
              }),
              {} as Record<string, any>
            )
          }

          res.status(404)
          return {
            error: 'Preset not found'
          }
        })
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
          tags,
          summary: 'Get all Presets',
          response: {
            200: sResponse.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const userId: string = req.session.get('userId')
        if (!userId) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        return {
          result: await PresetModel.find({ userId })
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
      id: S.string().optional(),
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
          tags,
          summary: 'Create a Preset',
          body: sBody.valueOf(),
          response: {
            201: sResponse.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const userId: string = req.session.get('userId')
        if (!userId) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const { id, ...body } = req.body
        if (typeof id === 'string') {
          ;(body as any)._id = id
        }

        const p = await PresetModel.create({
          ...body,
          userId
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
      id: S.string().optional()
    })

    f.patch<{
      Body: typeof sBody.type
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update a Preset',
          body: sBody.valueOf(),
          querystring: sQuerystring.valueOf(),
          response: {
            201: sSuccess.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const userId: string = req.session.get('userId')
        if (!userId) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const p = await PresetModel.findOne({
          userId,
          _id: req.query.id || ''
        })
        if (!p) {
          res.status(404)
          return {
            error: 'Preset not found'
          }
        }

        Object.assign(p, req.body)
        p.save()

        res.status(201)
        return {
          result: 'updated'
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
          tags,
          summary: 'Delete a Preset',
          querystring: sQuerystring.valueOf(),
          response: {
            201: sSuccess.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const userId: string = req.session.get('userId')
        if (!userId) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const p = await PresetModel.findOne({
          userId,
          _id: req.query.id
        })
        if (!p) {
          res.status(404)
          return {
            error: 'Preset not found'
          }
        }

        await p.deleteOne()
        res.status(201)
        return {
          result: 'deleted'
        }
      }
    )
  }
}

export default presetRouter
