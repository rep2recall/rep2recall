module.exports = {
  devServer: {
    proxy: {
      '^/api': {
        target: 'http://localhost:12345',
        ws: true
      },
      '^/media': {
        target: 'http://localhost:12345'
      }
    }
  },
  outputDir: process.env.OUT_DIR || '../e-server/web'
}
