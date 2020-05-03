module.exports = {
  devServer: {
    proxy: 'http://localhost:8080'
  },
  chainWebpack: (config) => {
    config
      .plugin('html')
      .tap((args) => {
        args[0].templateParameters = {
          title: 'Rep2Recall',
          description: 'Repeat until recall, with widening intervals.',
          canonicalUrl: process.env.VUE_APP_BASE_URL
        }
        return args
      })
  }
}
