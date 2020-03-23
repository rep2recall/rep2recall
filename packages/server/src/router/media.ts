import fs from 'fs'
import path from 'path'

import { FastifyInstance } from 'fastify'
// @ts-ignore
import fileUpload from 'fastify-file-upload'
import dayjs from 'dayjs'
import { UploadedFile } from 'express-fileupload'

import { mediaPath } from '../config'

const router = (f: FastifyInstance, opts: any, next: () => void) => {
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

  f.register(fileUpload)

  f.post('/upload', {
    schema: {
      tags: ['media'],
      summary: 'Upload media',
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'object' },
        },
      },
    },
  }, async (req) => {
    const file = req.body.file as UploadedFile

    let filename = file.name

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

    await file.mv(path.join(mediaPath, filename))

    return {
      filename,
    }
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

export default router
