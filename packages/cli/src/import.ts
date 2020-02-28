import fs from 'fs'

import { Apkg } from 'ankisync'

import { db, dbCard, dbNote, dbUser, dbSource, hash, dbTemplate, dbDeck } from './schema'

export async function fromApkg (filename: string) {
  const user = await db.first(dbUser)({}, {
    _id: dbUser.c._id,
  })
  if (!user) {
    throw new Error('A user is required')
  }

  const userId = user._id!

  const sourceId = await (async () => {
    const h = hash(fs.readFileSync(filename, 'utf8'))

    try {
      return await db.create(dbSource)({
        name: filename,
        h,
        userId: user._id!,
      })
    } catch (e) {
      return (await db.first(dbSource)({ h }, {
        _id: dbSource.c._id,
      }))!._id!
    }
  })()

  const apkg = await Apkg.connect(filename)
  const pp = [] as Promise<void>[]

  await apkg.anki2.each((entry) => {
    const promise = (async () => {
      const templateId = await (async () => {
        try {
          return await db.create(dbTemplate)({
            userId,
            sourceId,
            css: entry.css,
            name: entry.model,
            front: entry.qfmt,
            back: entry.afmt,
          })
        } catch (e) {
          return (await db.first(dbTemplate)({
            h: hash({
              css: entry.css,
              front: entry.qfmt,
              back: entry.afmt,
            }),
          }, {
            _id: dbTemplate.c._id,
          }))!._id!
        }
      })()

      const noteId = await (async () => {
        const d = {} as any
        const order = {} as any
        entry.keys.map((k, i) => {
          d[k] = entry.values[i]
          order[k] = i
        })

        try {
          return await db.create(dbNote)({
            userId,
            sourceId,
            data: d,
            order,
          })
        } catch (e) {
          return (await db.first(dbNote)({
            h: hash(d),
          }, {
            _id: dbNote.c._id,
          }))!._id!
        }
      })()

      const deckId = await (async () => {
        const deck = await db.first(dbDeck)({
          name: entry.deck,
          userId,
        }, {
          _id: dbDeck.c._id,
        })

        if (deck) {
          return deck._id!
        } else {
          return db.create(dbDeck)({
            name: entry.deck,
            userId,
          })
        }
      })()

      await db.create(dbCard)({
        userId,
        templateId,
        noteId,
        deckId,
      })
    })()

    pp.push(promise)
  })

  await Promise.all(pp)
  await apkg.cleanup()
}
