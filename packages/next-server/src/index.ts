import path from 'path'

import fastify from 'fastify'
import helmet from 'fastify-helmet'
import fastifyStatic from 'fastify-static'

const app = fastify()
const port = parseInt(process.env.PORT || '8080')

app.register(helmet)

app.register(fastifyStatic, {
  root: path.resolve('public')
})

app.setNotFoundHandler((_, reply) => {
  reply.sendFile('index.html')
})

app.listen(port, !process.env.IS_ONLINE ? 'localhost' : '0.0.0.0', (err) => {
  if (err) {
    throw err
  }

  console.log(`Go to http://localhost:${port}`)
})
