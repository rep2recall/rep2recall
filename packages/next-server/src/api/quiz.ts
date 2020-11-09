import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { sStatus } from '../db/types'
import { db } from '../shared'

const quizRouter = (f: FastifyInstance, _: any, next: () => void) => {
  postQ()
  postTreeview()

  next()

  function postQ() {
    const sBody = S.shape({
      decks: S.list(S.string()),
      q: S.string(),
      status: sStatus
    })

    const sResponse = S.shape({
      ids: S.list(S.string())
    })

    f.post<{
      Body: typeof sBody.type
    }>(
      '/quiz/q',
      {
        schema: {
          body: sBody.valueOf(),
          response: {
            200: sResponse.valueOf()
          }
        }
      },
      async (req): Promise<typeof sResponse.type> => {
        const { decks, q, status } = req.body

        return {
          ids: await db.quizQ(decks, { q, status })
        }
      }
    )
  }

  function postTreeview() {
    const sBody = S.shape({
      q: S.string(),
      status: sStatus
    })

    const sResponse = S.shape({
      data: S.list(
        S.shape({
          deck: S.list(S.string()),
          new: S.integer(),
          due: S.integer(),
          leech: S.integer()
        })
      )
    })

    f.post<{
      Body: typeof sBody.type
    }>(
      '/treeview',
      {
        schema: {
          body: sBody.valueOf(),
          response: {
            200: sResponse.valueOf()
          }
        }
      },
      async (req): Promise<typeof sResponse.type> => {
        const { q, status } = req.body

        return {
          data: await db.treeviewQ({ q, status })
        }
      }
    )
  }
}

export default quizRouter
