const path = require('path')

module.exports = {
  pages: {
    index: './src/renderer/main.ts',
  },
  configureWebpack: {
    resolve: {
      alias: {
        '~': path.resolve(__dirname, 'src/renderer/'),
        '@': path.resolve(__dirname, 'src/renderer/'),
        '@@': path.resolve(__dirname, 'src/'),
      },
    },
  },
}
