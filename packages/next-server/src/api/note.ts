import { FastifyInstance } from 'fastify'
import S from 'jsonschema-definer'

import { NoteAttrModel, NoteModel } from '../db/mongo'
import { IError, ISuccess, sError, sSuccess } from '../types'

const noteRouter = (f: FastifyInstance, _: unknown, next: () => void) => {
  getOne()
  getAttr()
  query()
  create()
  update()
  deleteOne()

  next()

  const tags = ['note']
  const sNote = S.shape({
    uid: S.string().optional(),
    deck: S.string().optional(),
    front: S.string().optional(),
    back: S.string().optional(),
    mnemonic: S.string().optional(),
    data: S.object().additionalProperties(true),
    tag: S.list(S.string()).optional(),
    srsLevel: S.integer().optional(),
    nextReview: S.string().format('date-time').optional(),
    lastRight: S.string().format('date-time').optional(),
    lastWrong: S.string().format('date-time').optional(),
    rightStreak: S.integer().optional(),
    wrongStreak: S.integer().optional(),
    maxRight: S.integer().optional(),
    maxWrong: S.integer().optional(),
    createdAt: S.string().format('date-time').optional(),
    updatedAt: S.string().format('date-time').optional(),
    attr: S.list(
      S.shape({
        key: S.string(),
        value: S.string()
      })
    ).optional()
  })

  /**
   * GET /
   */
  function getOne() {
    const sQuerystring = S.shape({
      select: S.list(S.string().enum(...Object.keys(sNote.type))),
      uid: S.string()
    })

    const sResponse = sNote

    f.get<{
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Get a Note',
          querystring: sQuerystring.valueOf(),
          response: {
            200: sResponse.valueOf(),
            401: sError.valueOf(),
            404: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const user: string = req.session.get('userId')
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        return NoteModel.findOne({ user, uid: req.query.uid }).then(
          async (r) => {
            if (r) {
              return req.query.select.reduce(
                (prev, c) => ({
                  ...prev,
                  [c]: (r as Record<string, any>)[c]
                }),
                {
                  attr: req.query.select.includes('attr')
                    ? await NoteAttrModel.find({ note: r }).then((ps) =>
                        ps.map((p) => ({
                          key: p.key,
                          value: p.value
                        }))
                      )
                    : undefined
                } as any
              )
            }

            res.status(404)
            return {
              error: 'Note not found'
            }
          }
        )
      }
    )
  }

  /**
   * GET /attr
   */
  function getAttr() {
    const sQuerystring = S.shape({
      uid: S.string(),
      attr: S.string()
    })

    f.get<{
      Querystring: typeof sQuerystring.type
    }>(
      '/attr',
      {
        schema: {
          tags,
          summary: 'Get a Note attribute',
          querystring: sQuerystring.valueOf(),
          response: {
            200: sSuccess.valueOf(),
            401: sError.valueOf(),
            404: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const user: string = req.session.get('userId')
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const r = await NoteModel.findOne({ user, uid: req.query.uid })
        if (!r) {
          res.status(404)
          return {
            error: 'Note not found'
          }
        }

        const a = await NoteAttrModel.findOne({ note: r, key: req.query.attr })
        if (!a) {
          res.status(404)
          return {
            error: 'NoteAttr not found'
          }
        }

        return {
          result: a.value
        }
      }
    )
  }

  /**
   * POST /q
   */
  function query() {
    const sBody = S.shape({
      select: S.list(S.string().enum(...Object.keys(sNote.type))),
      q: S.string().optional(),
      offset: S.integer().optional(),
      limit: S.integer().optional(),
      sortBy: S.string().optional(),
      desc: S.boolean().optional()
    })

    const sResponse = S.shape({
      result: S.list(sNote),
      count: S.integer()
    })

    f.post<{
      Body: typeof sBody.type
    }>(
      '/q',
      {
        schema: {
          tags,
          summary: 'Query for Notes',
          body: sBody.valueOf(),
          response: {
            200: sResponse.valueOf(),
            401: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const user: string = req.session.get('userId')
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const { select, q = '', offset = 0, limit } = req.body
        let { sortBy = 'updatedAt', desc = false } = req.body

        if (!req.body.sortBy && typeof req.body.desc === 'undefined') {
          sortBy = 'updatedAt'
          desc = true
        }

        return NoteModel.search(q, {
          user,
          isJoinNoteAttr: select.includes('attr'),
          post: [
            {
              $facet: {
                result: [
                  { $sort: { [sortBy]: desc ? -1 : 1 } },
                  ...(limit ? [{ $skip: offset }, { $limit: limit }] : []),
                  {
                    $project: select.reduce(
                      (prev, k) => ({
                        ...prev,
                        [k]: 1
                      }),
                      {
                        _id: 0
                      } as Record<string, number>
                    )
                  }
                ],
                count: [{ $count: 'count' }]
              }
            }
          ]
        }).then((rs) => ({
          result: rs[0]?.result || [],
          count: rs[0]?.count[0]?.count || 0
        }))
      }
    )
  }

  /**
   * PUT /
   */
  function create() {
    const sBody = sNote

    const sResponse = S.shape({
      uid: S.string()
    })

    f.put<{
      Body: typeof sBody.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Create a Note',
          body: sBody.valueOf(),
          response: {
            201: sResponse.valueOf(),
            401: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<typeof sResponse.type | IError> => {
        const user: string = req.session.get('userId')
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const { attr = [], ...body } = req.body

        return NoteModel.create({
          ...body,
          user
        }).then(async (r) => {
          await Promise.all(
            attr.map((a) =>
              NoteAttrModel.create({
                ...a,
                note: r
              })
            )
          )

          res.status(201)

          return {
            uid: r.uid!
          }
        })
      }
    )
  }

  /**
   * PATCH /
   */
  function update() {
    const sQuerystring = S.shape({
      uid: S.string()
    })
    const sBody = sNote

    f.patch<{
      Querystring: typeof sQuerystring.type
      Body: typeof sBody.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Update a Note',
          querystring: sQuerystring.valueOf(),
          body: sBody.valueOf(),
          response: {
            201: sSuccess.valueOf(),
            401: sError.valueOf(),
            404: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const user: string = req.session.get('userId')
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const r = await NoteModel.findOne({ user, uid: req.query.uid })
        if (!r) {
          res.status(404)
          return {
            error: 'Note not found'
          }
        }

        const { attr, ...body } = req.body

        Object.assign(r, body)

        await Promise.all([
          r.save(),
          (async () => {
            if (attr) {
              const attrMap = new Map<string, string>()
              attr.map((a) => {
                attrMap.set(a.key, a.value)
              })

              const ps = await NoteAttrModel.find({ note: r })
              const toUpdate: typeof ps[0][] = []
              const toDelete: typeof ps[0][] = []

              ps.map((p) => {
                const v = attrMap.get(p.key)
                if (typeof v !== 'undefined') {
                  if (v !== p.value) {
                    p.value = v
                    toUpdate.push(p)
                  }
                } else {
                  toDelete.push(p)
                }
              })

              return Promise.all([
                ...toUpdate.map((p) => p.save()),
                ...toDelete.map((p) => p.deleteOne())
              ])
            }
          })()
        ])

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
      uid: S.string()
    })

    f.delete<{
      Querystring: typeof sQuerystring.type
    }>(
      '/',
      {
        schema: {
          tags,
          summary: 'Delete a note',
          querystring: sQuerystring.valueOf(),
          response: {
            201: sSuccess.valueOf(),
            404: sError.valueOf()
          }
        }
      },
      async (req, res): Promise<ISuccess | IError> => {
        const user: string = req.session.get('userId')
        if (!user) {
          res.status(401)
          return {
            error: 'User not found'
          }
        }

        const r = await NoteModel.findOne({ user, uid: req.query.uid })
        if (!r) {
          res.status(404)
          return {
            error: 'Note not found'
          }
        }

        await r.deleteOne()
        res.status(201)
        return {
          result: 'deleted'
        }
      }
    )
  }
}

export default noteRouter
