import crypto from 'crypto'

import PouchDB from 'pouchdb'
import { nanoid } from 'nanoid'
import escapeStringRegexp from 'escape-string-regexp'
import { Serialize } from 'any-serialize'
import { Observable } from 'observable-fns'
import sqlite from 'sqlite'
import sql3 from 'sqlite3'
import dotProp from 'dot-prop-immutable'
import { UploadedFile } from 'express-fileupload'

import { split } from './shlex'
import { slugify, chunks, deepMerge } from './util'
import { repeatReview, srsMap, getNextReview } from './quiz'
import { IDbSchema, zDbSchema, IDbUser, IDbDeck, IDbLesson, IDbQuiz, IDbCard } from './schema'

const ser = new Serialize()

PouchDB.plugin(require('pouchdb-find'))
PouchDB.plugin(require('pouchdb-adapter-node-websql'))

type PouchContent =
  { type: 'user'; data: IDbUser } |
  { type: 'card'; data: IDbCard } |
  { type: 'quiz'; data: IDbQuiz } |
  { type: 'lesson'; data: IDbLesson } |
  { type: 'deck'; data: IDbDeck }

export class Db {
  pouch: PouchDB.Database<PouchContent>

  constructor (
    public url: string,
    options: PouchDB.Configuration.RemoteDatabaseConfiguration |
      PouchDB.Configuration.LocalDatabaseConfiguration = {}
  ) {
    this.pouch = new PouchDB(url, options)
  }

  async init () {
    return await Promise.all([
      this.pouch.createIndex({
        index: {
          fields: ['type', 'data.email', 'data.secret']
        }
      }),
      this.pouch.createIndex({
        index: {
          fields: ['type', 'data.name', '_id']
        }
      }),
      this.pouch.createIndex({
        index: {
          fields: ['type', 'data.markdown', 'data.tag', 'data.userId', '_id']
        }
      }),
      this.pouch.createIndex({
        index: {
          fields: ['type', 'data.srsLevel', 'data.nextReview', '_id']
        }
      }),
      this.pouch.createIndex({
        index: {
          fields: ['type', 'data.cardIds']
        }
      })
    ])
  }

  async getUserId () {
    const { g } = await import('../config')
    g.userId = g.userId || await this.signInOrCreate()

    return g.userId
  }

  async signInOrCreate (email?: string) {
    if (email) {
      const r = (await this.pouch.find({
        selector: {
          type: 'user',
          'data.email': email,
          'data.secret': { $gte: null }
        }
      })).docs[0]
      if (r) {
        return r._id
      }
    } else {
      const r = (await this.pouch.find({
        selector: {
          type: 'user',
          'data.email': { $exists: false },
          'data.secret': { $gte: null }
        }
      })).docs[0]
      if (r) {
        return r._id
      }
    }

    const r = await this.pouch.post({
      type: 'user',
      data: {
        email,
        secret: generateSecret(),
        createdAt: new Date().toISOString()
      }
    })

    return r.id
  }

  async signInWithSecret (email: string, secret: string) {
    const r = await this.pouch.find({
      selector: {
        type: 'user',
        'data.email': email,
        'data.secret': secret
      }
    })

    if (r && r.docs[0]) {
      return r.docs[0]._id
    }

    return null
  }

  async newSecret (userId: string) {
    const r = await this.pouch.get(userId)
    if (r.type !== 'user') {
      return null
    }

    const secret = generateSecret()

    await this.pouch.put({
      _id: userId,
      type: 'user',
      data: {
        ...r.data,
        secret
      }
    })

    return secret
  }

  async query (q: string | Record<string, any>, opts: {
    offset: number
    limit?: number
    sort: string
    fields?: string[]
  }): Promise<{
    result: IDbSchema[]
    count: number
  }> {
    const userId = await this.getUserId()

    const cond = typeof q === 'string' ? qToCond(q) : q
    let sortBy = opts.sort
    let direction: 'asc' | 'desc' = 'asc'
    if (sortBy[0] === '-') {
      sortBy = sortBy.substr(1)
      direction = 'desc'
    }

    const fields = opts.fields || [
      'id', 'data', 'markdown', 'tag', 'ref', 'media',
      'lesson', 'deck',
      'nextReview', 'srsLevel', 'stat'
    ]

    const isJoinLesson = !!cond.lesson || sortBy === 'lesson'
    const isJoinQuiz = ['nextReview', 'srsLevel'].some((k) => cond[k]) ||
      Object.keys(cond).some((k) => k.startsWith('stat.')) ||
      ['nextReview', 'srsLevel'].includes(sortBy) || sortBy.startsWith('stat.')

    const dataCond = Object.entries(cond)
      .filter(([c]) => c.startsWith('data.'))
      .reduce((prev, [k, v]) => ({ ...prev, [`data.${k}`]: v }), {})
    const statCond = Object.entries(cond)
      .filter(([c]) => c.startsWith('stat.'))
      .reduce((prev, [k, v]) => ({ ...prev, [`data.${k}`]: v }), {})

    const validIds = new Map<string, string>()

    if (isJoinLesson) {
      if (isJoinQuiz) {
        const rDeck = await this.pouch.find({
          selector: {
            type: 'deck',
            'data.name': cond.deck || { $gte: null },
            _id: { $gte: null }
          },
          fields: [
            'data.cardIds', 'data.lessonId',
            ...(sortBy === 'deck' ? ['data.name'] : [])
          ]
        })

        const rLesson = await this.pouch.find({
          selector: {
            type: 'lesson',
            'data.name': cond.lesson || { $gte: null },
            _id: {
              $in: rDeck.docs.map((d) => {
                if (d.type === 'deck') {
                  return d.data.lessonId
                }
                return null
              }).filter((el) => el)
            }
          },
          fields: [
            '_id',
            ...(sortBy === 'lesson' ? ['data.name'] : [])
          ]
        })

        const validLessonIds = new Set(rLesson.docs.map((d) => d._id))

        const validCard = rDeck.docs.filter((d) => {
          if (d.type === 'deck') {
            return validLessonIds.has(d.data.lessonId)
          } else {
            return []
          }
        })

        const rCard = await this.pouch.find({
          selector: {
            type: 'card',
            'data.markdown': cond.markdown || { $gte: null },
            'data.tag': cond.tag || { $elemMatch: { $gte: null } },
            'data.userId': userId,
            _id: { $in: validCard.map((c) => c._id) },
            ...dataCond
          },
          fields: [
            '_id', 'quizId'
          ]
        })

        const allQuizIds = rCard.docs.map((d) => {
          if (d.type === 'card') {
            return d.data.quizId
          } else {
            return null
          }
        }).filter((el) => el)

        const rQuiz = await this.pouch.find({
          selector: {
            type: 'quiz',
            'data.srsLevel': cond.srsLevel || { $gte: null },
            'data.nextReview': cond.nextReview || { $gte: null },
            _id: {
              $in: allQuizIds
            },
            ...statCond
          },
          fields: [
            '_id',
            ...(sortBy === 'srsLevel' ? ['data.srsLevel'] : []),
            ...(sortBy === 'nextReview' ? ['data.nextReview'] : [])
          ]
        })

        const validQuizIds = new Set(rQuiz.docs.map((r) => r._id))

        validCard.filter((d) => {
          return d.type === 'card' && (d.data.quizId
            ? validQuizIds.has(d.data.quizId)
            : true)
        }).map((d) => {
          if (d.type === 'card') {
            if (sortBy === 'deck') {
              const kDeck = rDeck.docs
                .filter((d1) => d1.type === 'deck' && d1.data.cardIds.includes(d._id))[0]
              if (kDeck && kDeck.type === 'deck') {
                return validIds.set(kDeck.data.name + nanoid(), d._id)
              }
            } else if (sortBy === 'lesson') {
              const kDeck = rDeck.docs
                .filter((d1) => d1.type === 'deck' && d1.data.cardIds.includes(d._id))[0]
              if (kDeck && kDeck.type === 'deck') {
                const kLesson = rLesson.docs
                  .filter((d1) => d1.type === 'lesson' && kDeck.data.lessonId === d1._id)[0]
                if (kLesson && kLesson.type === 'lesson') {
                  return validIds.set(kLesson.data.name + nanoid(), d._id)
                }
              }
            } else if (sortBy === 'srsLevel' || sortBy === 'nextReview') {
              const kQuiz = rQuiz.docs
                .filter((d1) => d1.type === 'quiz' && d.data.quizId === d1._id)[0]
              if (kQuiz && kQuiz.type === 'quiz') {
                if (sortBy === 'srsLevel') {
                  // srsLevel is always one digit anyway, so it doesn't matter
                  return validIds.set(kQuiz.data[sortBy].toString().padStart(2) + nanoid(), d._id)
                }
                return validIds.set(kQuiz.data[sortBy] + nanoid(), d._id)
              }
            }
          }

          return validIds.set('__' + nanoid(), d._id)
        })
      } else {
        const rDeck = await this.pouch.find({
          selector: {
            type: 'deck',
            'data.name': cond.deck || { $gte: null },
            _id: { $gte: null }
          },
          fields: [
            'data.cardIds', 'data.lessonId',
            ...(sortBy === 'deck' ? ['data.name'] : [])
          ]
        })

        const rLesson = await this.pouch.find({
          selector: {
            type: 'lesson',
            'data.name': cond.lesson || { $gte: null },
            _id: {
              $in: rDeck.docs.map((d) => {
                if (d.type === 'deck') {
                  return d.data.lessonId
                }
                return null
              }).filter((el) => el)
            }
          },
          fields: [
            '_id',
            ...(sortBy === 'lesson' ? ['data.name'] : [])
          ]
        })

        const validLessonIds = new Set(rLesson.docs.map((d) => d._id))

        const validCard = rDeck.docs.filter((d) => {
          if (d.type === 'deck') {
            return validLessonIds.has(d.data.lessonId)
          } else {
            return []
          }
        })

        const rCard = await this.pouch.find({
          selector: {
            type: 'card',
            'data.markdown': cond.markdown || { $gte: null },
            'data.tag': cond.tag || { $elemMatch: { $gte: null } },
            'data.userId': userId,
            _id: { $in: validCard.map((c) => c._id) },
            ...dataCond
          },
          fields: [
            '_id'
          ]
        })

        rCard.docs.map((d) => {
          if (d.type === 'card') {
            if (sortBy === 'deck') {
              const kDeck = rDeck.docs
                .filter((d1) => d1.type === 'deck' && d1.data.cardIds.includes(d._id))[0]
              if (kDeck && kDeck.type === 'deck') {
                return validIds.set(kDeck.data.name + nanoid(), d._id)
              }
            } else if (sortBy === 'lesson') {
              const kDeck = rDeck.docs
                .filter((d1) => d1.type === 'deck' && d1.data.cardIds.includes(d._id))[0]
              if (kDeck && kDeck.type === 'deck') {
                const kLesson = rLesson.docs
                  .filter((d1) => d1.type === 'lesson' && kDeck.data.lessonId === d1._id)[0]
                if (kLesson && kLesson.type === 'lesson') {
                  return validIds.set(kLesson.data.name + nanoid(), d._id)
                }
              }
            }
          }

          return validIds.set('__' + nanoid(), d._id)
        })
      }
    } else if (isJoinQuiz) {
      const rCard = await this.pouch.find({
        selector: {
          type: 'card',
          'data.markdown': cond.markdown || { $gte: null },
          'data.tag': cond.tag || { $elemMatch: { $gte: null } },
          'data.userId': userId,
          _id: { $gte: null },
          ...dataCond
        },
        fields: [
          '_id', 'quizId'
        ]
      })

      const allQuizIds = rCard.docs.map((d) => {
        if (d.type === 'card') {
          return d.data.quizId
        } else {
          return null
        }
      }).filter((el) => el)

      const rQuiz = await this.pouch.find({
        selector: {
          type: 'quiz',
          'data.srsLevel': cond.srsLevel || { $gte: null },
          'data.nextReview': cond.nextReview || { $gte: null },
          _id: {
            $in: allQuizIds
          },
          ...statCond
        },
        fields: [
          '_id',
          ...(sortBy === 'srsLevel' ? ['data.srsLevel'] : []),
          ...(sortBy === 'nextReview' ? ['data.nextReview'] : [])
        ]
      })

      const validQuizIds = new Set(rQuiz.docs.map((r) => r._id))

      rCard.docs.filter((d) => {
        return d.type === 'card' && (d.data.quizId
          ? validQuizIds.has(d.data.quizId)
          : true)
      }).map((d) => {
        if (d.type === 'card') {
          if (sortBy === 'srsLevel' || sortBy === 'nextReview') {
            const kQuiz = rQuiz.docs
              .filter((d1) => d1.type === 'quiz' && d.data.quizId === d1._id)[0]
            if (kQuiz && kQuiz.type === 'quiz') {
              if (sortBy === 'srsLevel') {
                // srsLevel is always one digit anyway, so it doesn't matter
                return validIds.set(kQuiz.data[sortBy].toString().padStart(2) + nanoid(), d._id)
              }
              return validIds.set(kQuiz.data[sortBy] + nanoid(), d._id)
            }
          }
        }

        return validIds.set('__' + nanoid(), d._id)
      })
    }

    const count = validIds.size
    const result = await Promise.all(Array.from(validIds).sort(([k1], [k2]) => {
      return direction === 'desc' ? k2.localeCompare(k1) : k1.localeCompare(k2)
    }).slice(opts.offset, opts.limit ? opts.limit + opts.offset : undefined).map(async ([_, id]) => {
      const r = await this.pouch.get(id)

      let data
      let markdown
      let tag
      let ref
      let media

      if (r && r.type === 'card') {
        data = r.data.data
        markdown = r.data.markdown
        tag = r.data.tag
        ref = r.data.ref
        media = r.data.media
      }

      let lesson: any
      let deck: any

      if (['lesson', 'deck'].some((c) => fields.includes(c))) {
        const d = (await this.pouch.find({
          selector: {
            type: 'deck',
            'data.cardIds': { $elemMatch: id }
          }
        })).docs[0]
        if (d && d.type === 'deck') {
          deck = d.data.name

          const rLesson = await this.pouch.get(d.data.lessonId)
          if (rLesson && rLesson.type === 'lesson') {
            lesson = rLesson.data.name
          }
        }
      }

      let nextReview: any
      let srsLevel: any
      let stat: any

      if (['nextReview', 'srsLevel', 'stat'].some((c) => fields.includes(c))) {
        if (r && r.type === 'card' && r.data.quizId) {
          const rQuiz = await this.pouch.get(r.data.quizId)
          if (rQuiz && rQuiz.type === 'quiz') {
            nextReview = rQuiz.data.nextReview
            srsLevel = rQuiz.data.srsLevel
            stat = rQuiz.data.stat
          }
        }
      }

      const row: IDbSchema = {
        id,
        data,
        markdown,
        tag,
        ref,
        media,
        lesson,
        deck,
        nextReview,
        srsLevel,
        stat
      }

      return row
    }))

    return {
      result,
      count
    }
  }

  async insert (...entries: IDbSchema[]) {
    const userId = await this.getUserId()
    const createdAt = new Date().toISOString()

    const defaultLessonId = await this.getDefaultLessonId()
    await Promise.all(entries.map(async (el) => {
      el.id = el.id || nanoid()
      const ops: Promise<any>[] = []

      let quizId: string | undefined
      if (typeof el.srsLevel !== 'undefined' && el.nextReview && el.stat) {
        quizId = nanoid()
        const dataQuiz: IDbQuiz = {
          srsLevel: el.srsLevel || 0,
          nextReview: el.nextReview,
          stat: el.stat
        }

        ops.push(this.pouch.put({
          _id: quizId,
          type: 'quiz',
          data: dataQuiz
        }))
      }

      let lessonId: string | undefined
      if (el.lesson) {
        el.lessonDescription = el.lessonDescription || ''
        lessonId = `lesson/${el.lesson}/${ser.hash(el.lessonDescription)}`

        const dataLesson: IDbLesson = {
          name: el.lesson,
          description: el.lessonDescription,
          createdAt
        }

        ops.push(this.pouch.put({
          _id: lessonId,
          type: 'lesson',
          data: dataLesson
        }))
      }

      if (el.deck) {
        lessonId = lessonId || defaultLessonId
        const deckId = `deck/${lessonId}/${el.deck}`

        ops.push(this.pouch.get(deckId)
          .then((doc) => {
            if (doc.type === 'deck') {
              doc.data.cardIds.push(el.id!)
              return this.pouch.put({
                _id: deckId,
                type: 'deck',
                data: doc.data
              })
            }
            return null
          })
          .catch(async () => {
            const deckData: IDbDeck = {
              name: el.deck!,
              lessonId: lessonId!,
              cardIds: [el.id!]
            }

            this.pouch.put({
              _id: deckId,
              type: 'deck',
              data: deckData
            })

            return deckData
          })
        )
      }

      const dataCard: IDbCard = {
        userId,
        data: el.data || {},
        markdown: el.markdown || '',
        createdAt,
        tag: el.tag || [],
        ref: el.ref || {},
        media: el.media || {},
        quizId
      }

      ops.push(this.pouch.put({
        _id: el.id,
        type: 'card',
        data: dataCard
      }))

      return Promise.all(ops)
    }))

    return entries.map((el) => el.id!)
  }

  async import (filename: string) {
    const srcDb = new Db(filename, { adapter: 'websql' })
    return new Observable<
      PouchDB.Replication.ReplicationResult<PouchContent>
    >((obs) => {
      srcDb.pouch.replicate.to(this.pouch, {
        live: true
      })
        .on('change', (info) => {
          obs.next(info)
        })
        .on('error', (error) => {
          obs.error(error)
        })
        .on('complete', async (info) => {
          obs.next(info)
          await srcDb.pouch.close()
          obs.complete()
        })
    })
  }

  async export (filename: string, cardIds: string[]) {
    const dstDb = new Db(filename, { adapter: 'websql' })
    return new Observable<
      PouchDB.Replication.ReplicationResult<PouchContent>
    >((obs) => {
      (async () => {
        const [userId, rQuiz, rDeck, rLesson] = await Promise.all([
          this.getUserId(),
          this.getQuizFromCard(cardIds, ['_id']),
          this.getDeckFromCard(cardIds, ['_id']),
          this.getLessonFromCard(cardIds, ['_id']),
          dstDb.init()
        ])

        this.pouch.replicate.to(dstDb.pouch, {
          doc_ids: [
            userId,
            ...cardIds,
            ...rQuiz.map((d) => d._id),
            ...rDeck.map((d) => d._id),
            ...rLesson.map((d) => d._id)
          ],
          live: true
        })
          .on('change', (info) => {
            obs.next(info)
          })
          .on('error', (error) => {
            obs.error(error)
          })
          .on('complete', async (info) => {
            obs.next(info)
            await dstDb.pouch.close()
            obs.complete()
          })
      })().catch((error) => {
        obs.error(error)
      })
    })
  }

  async importAnki2 (filename: string, meta: {
    originalFilename?: string
  } = {}) {
    return new Observable<{
      message: string
      percent?: number
    }>((obs) => {
      (async () => {
        obs.next({
          message: `Opening ${filename} as SQLite database`
        })
        const srcDb = await sqlite.open({
          filename,
          driver: sql3.Database
        })

        obs.next({
          message: 'Creating additional tables'
        })
        await srcDb.exec(/*sql*/`
        CREATE TABLE IF NOT EXISTS decks (
          id      INTEGER PRIMARY KEY,
          [name]  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS media (
          id      INTEGER PRIMARY KEY,
          [name]  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS models (
          id      INTEGER PRIMARY KEY,
          [name]  TEXT NOT NULL,
          flds    TEXT NOT NULL,  -- \x1f field
          css     TEXT
        );
        CREATE TABLE IF NOT EXISTS templates (
          mid     INTEGER NOT NULL REFERENCES models(id),
          ord     INTEGER NOT NULL,
          [name]  TEXT NOT NULL,
          qfmt    TEXT NOT NULL,
          afmt    TEXT
        );
        `)

        obs.next({
          message: 'Filling additional tables with JSON data from table: col'
        })

        const { decks, models } = await srcDb.get(/*sql*/`
          SELECT decks, models FROM col
        `)!

        await Promise.all(Object.values(JSON.parse(decks)).map(async (d: any) => {
          await srcDb.run(/*sql*/`
            INSERT INTO decks (id, [name]) VALUES (?, ?)
          `, [parseInt(d.id), d.name])
        }))

        await Promise.all(Object.values(JSON.parse(models)).map(async (m: any) => {
          await srcDb.run(/*sql*/`
          INSERT INTO models (id, [name], flds, css)
          VALUES (?, ?, ?, ?)
        `, [parseInt(m.id), m.name, m.flds.map((f: any) => f.name).join('\x1f'), m.css])

          await Promise.all(m.tmpls.map(async (t: any, i: number) => {
            await srcDb.run(/*sql*/`
            INSERT INTO templates (mid, ord, [name], qfmt, afmt)
            VALUES (?, ?, ?, ?, ?)
          `, [parseInt(m.id), i, t.name, t.qfmt, t.afmt])
          }))
        }))

        const allAnkiCards = await srcDb.all(/*sql*/`
          SELECT
            d.name AS deck,
            n.flds AS [values],
            m.flds AS keys,
            m.css AS css,
            t.qfmt AS qfmt,
            t.afmt AS afmt,
            t.name AS template,
            m.name AS model
          FROM cards AS c
          JOIN notes AS n ON c.nid = n.id
          JOIN decks AS d ON c.did = d.id
          JOIN models AS m ON n.mid = m.id
          JOIN templates AS t ON t.ord = c.ord AND t.mid = n.mid
        `)

        await srcDb.close()

        obs.next({
          message: `Inserting Anki cards (total: ${allAnkiCards.length})`
        })

        const normalizeAnkiMustache = (s: string, keyData: string) => s.replace(
          /\{\{([^}]+?)\}\}/g,
          (_, p1) => {
            const [, prefix = '', type, name] = /^([/#])?(?:([^:]+?):)?(.+)$/.exec(p1) || ['', '', '', p1]

            if (prefix || type === 'text') {
              return `{{${prefix}${keyData}.data.${slugify(name)}}}`
            } else if (type === 'type') {
              return `<input type=text id=typeans placeholder="${keyData}.data.${slugify(name)}" />`
            }

            return `{{{${keyData}.data.${slugify(name)}}}}`
          }
        )

        for (const [i, cs] of chunks(allAnkiCards, 1000).entries()) {
          obs.next({
            message: `inserting cards: ${i * 1000} of ${allAnkiCards.length}`,
            percent: i * 1000 / allAnkiCards.length * 100
          })

          await this.insert(...cs.map((el) => {
            const ks: string[] = el.keys.split('\x1f').map((k: string) => slugify(k))
            const vs: string[] = el.values.split('\x1f')
            const data: any = {}
            ks.map((k, i) => { data[k] = vs[i] })

            const keyData = 'data_' + ser.hash(data)

            const css = el.css.trim() + '\n'
            const keyCss = css ? 'css_' + ser.hash({ css }) : ''

            const qfmt = normalizeAnkiMustache(el.qfmt, keyData)
            const afmt = normalizeAnkiMustache(el.afmt, keyData)

            const deck = el.deck.replace(/::/g, '/')

            const lesson = (meta.originalFilename || filename).replace(/\..+?$/, '')

            const cards: IDbSchema[] = [
              {
                onConflict: 'ignore',
                id: keyData,
                data
              },
              ...(keyCss ? [
                {
                  onConflict: 'ignore',
                  id: keyCss,
                  markdown: '```css parsed\n' + css + '\n```'
                }
              ] : []),
              {
                id: `anki_${name}_${el.model}_${el.template}_${keyData}`,
                lesson,
                lessonDescription: meta.originalFilename,
                deck,
                ref: [
                  keyData,
                  ...(keyCss ? [
                    keyCss
                  ] : [])
                ],
                markdown: qfmt + '\n\n===\n\n' + afmt + (keyCss ? ('\n\n===\n\n' + `{{{${keyCss}.markdown}}}`) : '')
              }
            ]

            return cards
          })
            .reduce((prev, c) => [...prev, ...c], [])
            .filter((c: any, i: number, arr: any[]) => arr.map((el) => el.key).indexOf(c.key) === i)
          )
        }

        obs.complete()
      })().catch(obs.error)
    })
  }

  async update (cardIds: string[], set: IDbSchema) {
    const {
      data, markdown, tag, ref, media,
      lesson, lessonDescription,
      deck,
      srsLevel, nextReview, stat
    } = zDbSchema.parse(set)

    if ([data, markdown, tag, ref, media].some((el) => typeof el !== 'undefined')) {
      await Promise.all(cardIds.map((id) => this.pouch.get(id)
        .then((d) => {
          return this.pouch.put({
            _id: d._id,
            type: d.type,
            data: deepMerge(d.data, { data, markdown, tag, ref, media })
          })
        })))
    }

    if ([lesson, lessonDescription].some((el) => typeof el !== 'undefined')) {
      await Promise.all((await this.getLessonFromCard(cardIds, ['_id'])).map((d) => this.pouch.get(d._id)
        .then((d) => {
          return this.pouch.put({
            _id: d._id,
            type: d.type,
            data: deepMerge(d.data, { name: lesson, description: lessonDescription })
          })
        })))
    }

    if (typeof deck !== 'undefined') {
      await Promise.all((await this.getDeckFromCard(cardIds, ['_id'])).map((d) => this.pouch.get(d._id)
        .then((d) => {
          return this.pouch.put({
            _id: d._id,
            type: d.type,
            data: deepMerge(d.data, { name: deck })
          })
        })))
    }

    if ([srsLevel, nextReview, stat].some((el) => typeof el !== 'undefined')) {
      await Promise.all((await this.getQuizFromCard(cardIds, ['_id'])).map((d) => this.pouch.get(d._id)
        .then((d) => {
          return this.pouch.put({
            _id: d._id,
            type: d.type,
            data: deepMerge(d.data, { srsLevel, nextReview, stat })
          })
        })))
    }
  }

  async delete (...cardIds: string[]) {
    const [rQuiz, rDeck, rLesson] = await Promise.all([
      this.getQuizFromCard(cardIds, ['_id']),
      this.getDeckFromCard(cardIds, ['_id']),
      this.getLessonFromCard(cardIds, ['_id'])
    ])

    await this.pouch.bulkDocs([
      ...cardIds,
      ...rQuiz.map((d) => d._id),
      ...rDeck.map((d) => d._id),
      ...rLesson.map((d) => d._id)
    ].map((id) => ({
      _id: id,
      _deleted: true
    } as any)))
  }

  async renderMin (cardId: string) {
    const r = await this.pouch.get(cardId)

    if (r.type === 'card') {
      return {
        _id: r._id,
        data: r.data.data,
        markdown: r.data.markdown,
        ref: r.data.ref,
        media: r.data.media
      }
    }

    return {}
  }

  markRight = this._updateSrsLevel(+1)
  markWrong = this._updateSrsLevel(-1)
  markRepeat = this._updateSrsLevel(0)

  _updateSrsLevel (dSrsLevel: number) {
    return async (cardId: string) => {
      const d = await this.getQuizFromCard([cardId], ['data.stat', 'data.srsLevel'])

      let srsLevel = 0
      let stat = {
        streak: {
          right: 0,
          wrong: 0,
          maxRight: 0,
          maxWrong: 0
        }
      }
      let nextReview = repeatReview().toISOString()

      if (d[0] && d[0].type === 'quiz') {
        srsLevel = d[0].data.srsLevel
        stat = d[0].data.stat
      }

      if (dSrsLevel > 0) {
        stat = dotProp.set(stat, 'streak.right', dotProp.get(stat, 'streak.right', 0) + 1)
        stat = dotProp.set(stat, 'streak.wrong', 0)
        stat = dotProp.set(stat, 'lastRight', new Date().toISOString())

        if (dotProp.get(stat, 'streak.right', 1) > dotProp.get(stat, 'streak.maxRight', 0)) {
          stat = dotProp.set(stat, 'streak.maxRight', dotProp.get(stat, 'streak.right', 1))
        }
      } else if (dSrsLevel < 0) {
        stat = dotProp.set(stat, 'streak.wrong', dotProp.get(stat, 'streak.wrong', 0) + 1)
        stat = dotProp.set(stat, 'streak.right', 0)
        stat = dotProp.set(stat, 'lastWrong', new Date())

        if (dotProp.get(stat, 'streak.wrong', 1) > dotProp.get(stat, 'streak.maxWrong', 0)) {
          stat = dotProp.set(stat, 'streak.maxWrong', dotProp.get(stat, 'streak.wrong', 1))
        }
      }

      srsLevel += dSrsLevel

      if (srsLevel >= srsMap.length) {
        srsLevel = srsMap.length - 1
      }

      if (srsLevel < 0) {
        srsLevel = 0
      }

      if (dSrsLevel > 0) {
        nextReview = getNextReview(srsLevel).toISOString()
      }

      if (!d[0]) {
        const r = await this.pouch.post({
          type: 'quiz',
          data: {
            stat,
            nextReview,
            srsLevel
          }
        })

        const c = await this.pouch.get(cardId)
        if (c.type === 'card') {
          this.pouch.put({
            _id: c._id,
            type: c.type,
            data: {
              ...c.data,
              quizId: r.id
            }
          })
        }
      } else {
        await this.pouch.put({
          _id: d[0]._id,
          type: 'quiz',
          data: {
            stat,
            nextReview,
            srsLevel
          }
        })
      }
    }
  }

  async insertMedia (file: UploadedFile, cardId: string) {
    await this.pouch.putAttachment(
      cardId,
      file.name,
      file.data,
      file.mimetype
    )
  }

  async getMedia (filename: string, cardId: string) {
    return await this.pouch.getAttachment(cardId, filename)
  }

  async allCardIds () {
    const userId = await this.getUserId()
    const r = await this.pouch.find({
      selector: {
        type: 'card',
        'data.userId': userId,
        _id: { $gte: null }
      },
      fields: ['_id']
    })
    return r.docs.map((d) => d._id)
  }

  async allLessons () {
    return await this.getLessonFromCard(await this.allCardIds())
  }

  async allTags () {
    const userId = await this.getUserId()
    const r = await this.pouch.find({
      selector: {
        type: 'card',
        'data.tag': { $elemMatch: { $in: [] } },
        'data.userId': userId
      },
      fields: ['data.tag']
    })

    return Array.from(new Set(r.docs.map((d) => {
      if (d.type === 'card') {
        return d.data.tag
      }
      return []
    }).reduce((prev, c) => [...prev, ...c], []))).sort()
  }

  async getQuizFromCard (cardIds?: string[], fields?: string[]) {
    const userId = await this.getUserId()

    const rCard = await this.pouch.find({
      selector: {
        type: 'card',
        'data.userId': userId,
        'data.quizId': { $exists: true },
        _id: cardIds ? { $in: cardIds } : { $gte: null }
      },
      fields: ['data.quizId']
    })

    const rQuiz = await this.pouch.find({
      selector: {
        type: 'quiz',
        _id: {
          $in: rCard.docs.map((d) => {
            if (d.type === 'card') {
              return d.data.quizId
            }
            return null
          }).filter((el) => el)
        }
      },
      fields
    })

    return rQuiz.docs
  }

  async getDeckFromCard (cardIds?: string[], fields?: string[]) {
    const rDeck = await this.pouch.find({
      selector: {
        type: 'deck',
        'data.cardIds': { $elemMatch: cardIds ? { $in: cardIds } : { $gte: null } }
      },
      fields
    })

    return rDeck.docs
  }

  async getLessonFromCard (cardIds?: string[], fields?: string[]) {
    const decks = await this.getDeckFromCard(cardIds, ['data.lessonId'])

    const rLesson = await this.pouch.find({
      selector: {
        type: 'lesson',
        _id: {
          $in: decks.map((d) => {
            if (d.type === 'deck') {
              return d.data.lessonId
            }
            return null
          }).filter((el) => el)
        }
      },
      fields
    })

    return rLesson.docs
  }

  _defaultLessonId: string | undefined

  async getDefaultLessonId () {
    const id = 'lesson/_'

    this._defaultLessonId = this._defaultLessonId || await this.pouch.get(id)
      .then((r) => r._id)
      .catch(async (err) => {
        console.error(err)

        const r = await this.pouch.put({
          _id: id,
          type: 'lesson',
          data: {
            name: 'Default',
            description: '',
            createdAt: new Date().toISOString()
          }
        })
        return r.id
      })

    return this._defaultLessonId
  }
}

function generateSecret () {
  return crypto.randomBytes(64).toString('base64')
}

function qToCond (q: string) {
  const fNumber = [
    'srsLevel',
    'stat.streak.right',
    'stat.streak.wrong',
    'stat.streak.maxRight',
    'stat.streak.maxWrong'
  ]
  const fDate = [
    'nextReview',
    'stat.lastRight',
    'stat.lastWring'
  ]

  const $or: any[] = []
  const cond: any = {}

  split(q || '').map((seg) => {
    let prefix = ''

    if (['+', '-', '?'].includes(seg[0])) {
      prefix = seg[0]
      seg = seg.substr(1)
    }

    let [, k, op = ':', v = seg] = /^([A-Z0-9.]+)([:><]=?).+$/i.exec(seg) || []

    const parse = (k0: string) => {
      if (prefix === '-') {
        op = ({
          ':': '$nsub',
          '>': '$lte',
          '>=': '$lt',
          '<': '$gte',
          '<=': '$gt'
        } as any)[op] || '$nsub'
      } else {
        op = ({
          ':': '$sub',
          '>': '$gt',
          '>=': '$gte',
          '<': '$lt',
          '<=': '$lte'
        } as any)[op] || '$sub'
      }

      let expr: any
      let v0: any = v

      if (!fNumber.includes(k0) && !fDate.includes(k0)) {
        if (op === '$sub') {
          expr = { [k0]: { $regex: escapeStringRegexp(v0) } }
        } else if (op === '$nsub') {
          expr = { [k0]: { $regex: `^((?!${escapeStringRegexp(v0)}).)*$` } }
        }
      }

      if (fNumber.includes(v0)) {
        v0 = parseFloat(v0)
      } else if (fDate.includes(v0)) {
        v0 = parseDate(v0)
      }

      if (!expr) {
        expr = { [k0]: { [op]: v0 } }
      }

      if (k0 === 'tag') {
        expr = { [k0]: { $elemMatch: expr[k0] } }
      }

      if (prefix === '?') {
        $or.push(expr)
      } else {
        Object.assign(cond, expr)
      }
    }

    if (!k) {
      for (const k0 of ['id', 'tag', 'lesson', 'deck']) {
        parse(k0)
      }
    } else {
      parse(k)
    }
  })

  if (!Object.keys(cond).length) {
    cond._id = { $gte: null }
  }

  if ($or.length) {
    cond.$or = $or
  }

  return cond
}

function parseDate (v: string) {
  if (v === 'NOW') {
    v = new Date().toISOString()
  } else {
    const vMillisec = (() => {
      const [, p1, p2] = /^([+-]?\d+(?:\.\d+)?)([yMwdhm])$/i.exec(v) || []
      const v0 = +new Date()
      if (p2 === 'y') {
        return v0 + parseFloat(p1) * 365 * 24 * 60 * 60 * 1000 // 365d 24h 60m 60s 1000ms
      } else if (p2 === 'M') {
        return v0 + parseFloat(p1) * 30 * 24 * 60 * 60 * 1000 // 30d 24h 60m 60s 1000ms
      } else if (p2 === 'w') {
        return v0 + parseFloat(p1) * 7 * 24 * 60 * 60 * 1000 // 7d 24h 60m 60s 1000ms
      } else if (p2 === 'd') {
        return v0 + parseFloat(p1) * 24 * 60 * 60 * 1000 // 24h 60m 60s 1000ms
      } else if (p2 === 'h') {
        return v0 + parseFloat(p1) * 60 * 60 * 1000 // 60m 60s 1000ms
      } else if (p2 === 'm') {
        return v0 + parseFloat(p1) * 60 * 1000 // 60s 1000ms
      }
      return null
    })()

    v = vMillisec ? new Date(vMillisec).toISOString() : v
  }

  return v
}
