module.exports = {
  devServer: {
    proxy: 'http://localhost:8080'
  },
  outputDir: process.env.OUT_DIR || 'dist'
}
