// @ts-check

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs')
const path = require('path')

const morgan = require('morgan')

const BINARY_DIR = 'release'
const ASSETS_DIR = '.'

module.exports = {
  outputDir: path.join(BINARY_DIR, 'www'),
  assetsDir: ASSETS_DIR,
  devServer: {
    /**
     *
     * @param {import('express').Express} app
     * @param {import('http').Server} server
     * @param {*} compiler
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    before (app, server, compiler) {
      app.use('/api', morgan('tiny'))

      app.get('/api/file', (req, res) => {
        /** @type {*} */
        const { filename } = req.query
        const p = path.resolve(__dirname, BINARY_DIR, filename)

        if (fs.existsSync(p)) {
          fs.createReadStream(p).pipe(res)
          return
        }

        res.sendStatus(404)
      })

      app.put('/api/file', (req, res) => {
        /** @type {*} */
        const { filename } = req.query
        const p = path.resolve(__dirname, BINARY_DIR, filename)

        req.pipe(fs.createWriteStream(p))
        res.sendStatus(201)
      })

      app.delete('/api/file', (req, res) => {
        /** @type {*} */
        const { filename } = req.query
        const p = path.resolve(__dirname, BINARY_DIR, filename)

        fs.unlinkSync(p)
        res.sendStatus(201)
      })
    }
  }
}
