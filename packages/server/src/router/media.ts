import fs from 'fs'
import path from 'path'

import { FastifyInstance } from 'fastify'
import multipart from 'fastify-multipart'
import pump from 'pump'
import dayjs from 'dayjs'

import { mediaPath } from '../config'

export default (f: FastifyInstance, opts: any, next: () => void) => {
  f.patch('/', {
    schema: {
      tags: ['media'],
      summary: 'Update media filename',
      body: {
        type: 'object',
        required: ['filename', 'newFilename'],
        properties: {
          filename: { type: 'string' },
          newFilename: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    const { filename, newFilename } = req.body
    fs.renameSync(path.join(mediaPath, filename), path.join(mediaPath, newFilename))

    return {
      success: true,
    }
  })

  f.register(multipart)

  f.post('/upload', {
    schema: {
      tags: ['media'],
      summary: 'Upload media',
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'array', items: { type: 'object' }, minItems: 1, maxItems: 1 },
        },
      },
    },
  }, (req, reply) => {
    if (!req.isMultipart()) {
      reply.code(400).send(new Error('Request is not multipart'))
      return
    }

    let filename = ''

    req.multipart((field, file, filename_) => {
      filename = filename_
      if (filename === 'image.png') {
        filename = dayjs().format('YYYYMMDD-HHmm') + '.png'
      }

      filename = (() => {
        const originalFilename = filename

        while (fs.existsSync(path.resolve(mediaPath, filename))) {
          const [base, ext] = originalFilename.split(/(\.[a-z]+)$/i)
          filename = base + '-' + Math.random().toString(36).substr(2) + (ext || '.png')
        }

        return filename
      })()

      const stream = fs.createWriteStream(path.join(mediaPath, filename))

      pump(file, stream)
    }, () => {
      reply.code(200).send({
        filename,
      })
    })
  })

  f.get('/:filename', {
    schema: {
      tags: ['media'],
      summary: 'Get media',
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string' },
        },
      },
    },
  }, (req, reply) => {
    const { filename } = req.params
    reply.sendFile(
      path.join(mediaPath, filename),
    )
  })

  next()
}
