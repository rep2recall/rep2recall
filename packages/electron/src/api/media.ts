import { URL } from 'url'

import { protocol } from 'electron'

protocol.registerBufferProtocol('r2r', (req, callback) => {
  (async () => {
    const u = new URL(req.url)

    if (u.pathname.startsWith('/media/')) {
      return { mimeType: 'text/html', data: Buffer.from('<h5>Response</h5>') }
    }

    return null
  })().then(callback).catch(callback)
}, (error) => {
  if (error) console.error('Failed to register protocol')
})
