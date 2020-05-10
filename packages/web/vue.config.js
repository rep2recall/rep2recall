const dotProp = require('dot-prop')
const showdown = require('showdown')
const { createIndentedFilter } = require('indent-utils')
const pug = require('pug')

const mdConverter = new showdown.Converter({
  simpleLineBreaks: true,
  emoji: true
})

mdConverter.addExtension({
  type: 'lang',
  filter: createIndentedFilter('pug', (str) => {
    return pug.render(str)
  })
}, 'pug')

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

    config.module.rule('pug').oneOf('raw-pug-files').use('pug-plain').loader('pug-plain-loader')
      .tap((options) => {
        options = options || {}
        dotProp.set(options, 'filters.markdown', (s) => {
          return mdConverter.makeHtml(s)
        })
        return options
      })

    config.module.rule('pug').oneOf('vue-loader').use('pug-plain').loader('pug-plain-loader')
      .tap((options) => {
        options = options || {}
        dotProp.set(options, 'filters.markdown', (s) => {
          return mdConverter.makeHtml(s)
        })
        return options
      })
  }
}
