/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs')
const path = require('path')

const bodyParser = require('body-parser')

const NEU_DIR = 'release'

module.exports = {
  assetsDir: 'assets/',
  devServer: {
    /**
     *
     * @param {import('express').Express} app
     * @param {import('http').Server} server
     * @param {*} compiler
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    after (app, server, compiler) {
      app.use(bodyParser.json())

      app.get('/api/db', (req, res) => {
        const { filename } = req.query
        const p = path.resolve(__dirname, NEU_DIR, filename)

        if (fs.existsSync(p)) {
          res.json({
            content: fs.readFileSync(p, 'utf8')
          })
        }
        res.sendStatus(404)
      })

      app.put('/api/db', (req, res) => {
        const { filename } = req.query
        const p = path.resolve(__dirname, NEU_DIR, filename)

        const { content } = req.body

        fs.writeFileSync(p, content)

        res.sendStatus(201)
      })

      app.delete('/api/db', (req, res) => {
        const { filename } = req.query
        const p = path.resolve(__dirname, NEU_DIR, filename)

        fs.unlinkSync(p)

        res.sendStatus(201)
      })
    }
  }
}
