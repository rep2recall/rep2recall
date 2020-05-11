import path from 'path'

import { FastifyInstance } from 'fastify'
import ws from 'fastify-websocket'
// @ts-ignore
import fileUpload from 'fastify-file-upload'
import { nanoid } from 'nanoid'
import { UploadedFile } from 'express-fileupload'
import AdmZip from 'adm-zip'

import { tmpPath, db } from '../config'
import { Db } from '../db/local'

export default (f: FastifyInstance, _: any, next: () => void) => {
  f.register(fileUpload)
  f.post('/upload', {
    schema: {
      tags: ['file'],
      summary: 'Upload an archive',
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }
  }, async (req) => {
    const id = nanoid()
    const file = req.body.file as UploadedFile

    await new Promise((resolve, reject) => {
      file.mv(path.join(tmpPath, id), (err) => {
        err ? reject(err) : resolve()
      })
    })

    return { id }
  })

  const processMap = new Map<string, any>()

  f.register(ws)
  f.get('/process', {
    websocket: true,
    schema: {
      tags: ['file'],
      summary: 'Process an archive'
    }
  }, (conn) => {
    conn.socket.on('message', (msg: string) => {
      const { id, type, filename } = JSON.parse(msg)

      let isNew = false
      if (!processMap.has(id)) {
        processMap.set(id, { type })
        isNew = true
      }

      if (isNew) {
        if (type === 'apkg') {
          const zip = new AdmZip(path.join(tmpPath, id))
          conn.socket.send('extracting APKG')
          zip.extractAllTo(path.join(tmpPath, id + '-folder'))
          db.importAnki2(path.join(tmpPath, id + '-folder', 'collection.anki2'), (msg) => {
            conn.socket.send(msg)
          }, { filename })
        } else if (type === 'anki2') {
          db.importAnki2(path.join(tmpPath, id), (msg) => {
            conn.socket.send(msg)
          }, { filename })
        } else {
          const src = new Db(path.join(tmpPath, id))
          db.import(src, (msg) => {
            conn.socket.send(msg)
          })
        }

        conn.socket.send('done')
      }
    })
  })

  next()
}
