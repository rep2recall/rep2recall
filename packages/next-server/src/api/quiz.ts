import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { NoteModel } from '../db/mongo'
import { IError, ISuccess, sStatus, sSuccess } from '../types'
import { shuffle } from './util'

const quizRouter = (f: FastifyInstance, _: any, next: () => void) => {
  const tags = ['quiz']

  buildQuiz()
  postTreeview()
  doMark()

  next()

  /**
   * POST /
   */
  function buildQuiz() {
    const sBody = S.shape({
      decks: S.list(S.string()),
      q: S.string(),
      status: sStatus
    })

    const sResponse = S.shape({
      result: S.list(S.string())
    })

    f.post<{
      Body: typeof sBody.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Create a Quiz',
          body: sBody.valueOf(),
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

        const { decks, q, status } = req.body

        return {
          result: await NoteModel.search(q, {
            userId,
            decks,
            status,
            post: [
              {
                $project: { _id: 1 }
              }
            ]
          }).then((rs) => shuffle(rs).map(({ _id }) => _id as string))
        }
      }
    )
  }

  /**
   * POST /treeview
   */
  function postTreeview() {
    const sBody = S.shape({
      q: S.string(),
      status: sStatus
    })

    const sResponse = S.shape({
      result: S.list(
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
          tags,
          summary: 'Query stats for a treeview',
          body: sBody.valueOf(),
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

        const { q, status } = req.body
        const now = new Date()

        return {
          result: await NoteModel.search(q, {
            userId,
            status,
            post: [
              {
                $group: {
                  _id: '$deck',
                  stat: {
                    $push: {
                      nextReview: '$nextReview',
                      srsLevel: '$srsLevel',
                      wrongStreak: '$wrongStreak'
                    }
                  }
                }
              }
            ]
          }).then((rs) =>
            rs.map(
              ({
                _id,
                stat
              }: {
                _id: string
                stat: {
                  nextReview?: Date
                  srsLevel?: number
                  wrongStreak?: number
                }[]
              }) => ({
                deck: _id.split(/::/g),
                new: stat.filter((s) => typeof s.srsLevel === 'undefined')
                  .length,
                due: stat.filter((s) =>
                  s.nextReview ? s.nextReview < now : true
                ).length,
                leech: stat.filter(
                  (s) =>
                    s.srsLevel === 0 ||
                    (s.wrongStreak ? s.wrongStreak > 2 : false)
                ).length
              })
            )
          )
        }
      }
    )
  }

  /**
   * PATCH /mark
   */
  function doMark() {
    const sQuerystring = S.shape({
      uid: S.string(),
      as: S.string().enum('right', 'wrong', 'repeat')
    })

    f.patch<{
      Querystring: typeof sQuerystring.type
    }>(
      '/mark',
      {
        schema: {
          tags,
          summary: 'Mark a Note as right, wrong or repeat',
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

        const n = await NoteModel.findOne({
          userId,
          uid: req.query.uid
        })

        if (!n) {
          res.status(404)
          return {
            error: 'Note not found'
          }
        }

        ;({
          right: () => n.markRight(),
          wrong: () => n.markWrong(),
          repeat: () => n.markRepeat()
        }[req.query.as]())

        res.status(201)
        return {
          result: 'updated'
        }
      }
    )
  }
}

export default quizRouter
