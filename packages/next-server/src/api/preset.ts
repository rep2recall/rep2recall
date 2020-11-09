import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { sStatus } from '../db/types'
import { db } from '../shared'

const presetRouter = (f: FastifyInstance, _: any, next: () => void) => {
  getAll()
  putOne()
  patchOne()
  deleteOne()

  next()

  function getAll() {
    const sResponse = S.shape({
      data: S.list(
        S.shape({
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
            200: sResponse.valueOf()
          }
        }
      },
      async (): Promise<typeof sResponse.type> => {
        return {
          data: await db.presetQ()
        }
      }
    )
  }

  function putOne() {
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
            201: sResponse.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type> => {
        const id = await db.presetInsert(req.body)

        res.status(201)
        return {
          id
        }
      }
    )
  }

  function patchOne() {
    const sBody = S.shape({
      q: S.string(),
      status: sStatus,
      selected: S.list(S.string()),
      opened: S.list(S.string())
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
          querystring: sQuerystring.valueOf()
        }
      },
      async (req, res) => {
        await db.presetUpdate(req.query.id, req.body)

        res.status(201)
        return {}
      }
    )
  }

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
          querystring: sQuerystring.valueOf()
        }
      },
      async (req, res) => {
        await db.presetDelete(req.query.id)

        res.status(201)
        return {}
      }
    )
  }
}

export default presetRouter
