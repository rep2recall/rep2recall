import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { sStatus } from '../db/types'
import { db } from '../shared'

const quizRouter = (f: FastifyInstance, _: any, next: () => void) => {
  getTagQ()
  postQ()

  next()

  async function getTagQ () {
    const sResponse = S.shape({
      tags: S.list(S.shape({
        name: S.string(),
        q: S.string(),
        status: sStatus,
        itemSelected: S.list(S.string()),
        itemOpened: S.list(S.string())
      }))
    })

    f.get('/tag/q', {
      schema: {
        response: {
          200: sResponse.valueOf()
        }
      }
    }, async (): Promise<typeof sResponse.type> => {
      return {
        tags: await db.tagQ()
      }
    })
  }

  async function postQ () {
    const sBody = S.shape({
      decks: S.list(S.string()),
      status: sStatus
    })

    const sResponse = S.shape({
      quizIds: S.list(S.string())
    })

    f.post<{
      Body: typeof sBody.type
    }>('/quiz/q', {
      schema: {
        body: sBody.valueOf(),
        response: {
          200: sResponse.valueOf()
        }
      }
    }, async (req): Promise<typeof sResponse.type> => {
      const { decks, status } = req.body

      return {
        quizIds: await db.queryQuiz(decks, status)
      }
    })
  }

  async function getTreeview() {
    const sQuerystring = S.shape({
      tag: S.string()
    })

    const sResponse = S.shape({
      tags: S.list(S.shape({
        q: S.string(),
        status: sStatus,
        itemSelected: S.list(S.string()),
        itemOpened: S.list(S.string())
      }))
    })

    f.get('/treeview')
  }
}

export default quizRouter
