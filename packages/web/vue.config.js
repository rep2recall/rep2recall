module.exports = {
  lintOnSave: false,
  transpileDependencies: ['vuetify'],
  devServer: {
    proxy: {
      '^/(api|media)/': {
        target: 'http://localhost:36393'
      }
    }
  }
}
