module.exports = {
  devServer: {
    proxy: 'http://localhost:24000',
  },
  outputDir: '../../heroku/public',
}
