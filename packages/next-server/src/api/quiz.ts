import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { NoteModel, UserModel } from '../db/mongo'
import { IError, ISuccess, sError, sStatus, sSuccess } from '../types'
import { shuffle } from './util'

const quizRouter = (f: FastifyInstance, _: any, next: () => void) => {
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
          body: sBody.valueOf(),
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

        const { decks, q, status } = req.body

        return {
          result: await NoteModel.search(q, {
            user: user._id,
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
          body: sBody.valueOf(),
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

        const { q, status } = req.body
        const now = new Date()

        return {
          result: await NoteModel.search(q, {
            user: user._id,
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
          querystring: sQuerystring.valueOf(),
          response: {
            201: sSuccess.valueOf(),
            401: sError.valueOf(),
            404: sError.valueOf()
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

        const n = await NoteModel.findOne({
          user,
          uid: req.query.uid
        })

        if (!n) {
          res.status(404)
          return {
            error: 'note not found'
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
