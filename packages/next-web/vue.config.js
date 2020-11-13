module.exports = {
  lintOnSave: false,
  transpileDependencies: [
    'vuetify'
  ],
  outputDir: '../j-server/src/main/resources/public',
  devServer: {
    proxy: {
      '^/(api|media)/': {
        target: 'http://localhost:36393'
      }
    }
  }
}
