module.exports = {
  lintOnSave: false,
  transpileDependencies: [
    'vuetify'
  ],
  outputDir: '../j-server/src/main/resources/public',
  devServer: {
    proxy: {
      '^/api/': {
        target: 'http://localhost:36393'
      },
      '^/media/': {
        target: 'http://localhost:36393'
      }
    }
  }
}
