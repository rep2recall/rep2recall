export default {
  mode: 'universal',
  target: 'static',
  telemetry: false,
  /*
   ** Headers of the page
   */
  head: {
    title: 'Rep2Recall',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        hid: 'description',
        name: 'description',
        content: 'Repeat until recall, with widening intervals.',
      },
    ],
    link: [
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      {
        rel: 'manifest',
        href: '/site.webmanifest',
      },
    ],
    script: [
      {
        async: true,
        defer: true,
        'data-domain': 'rep2recall.net',
        src: 'https://plausible.io/js/plausible.js',
      },
    ],
  },
  /*
   ** Customize the progress-bar color
   */
  loading: { color: '#fff' },
  /*
   ** Global CSS
   */
  css: ['~/assets/app.scss'],
  /*
   ** Plugins to load before mounting the App
   */
  plugins: [
    '~/plugins/codemirror.client.js',
    '~/plugins/context.client.js',
    '~/plugins/filter.js',
    '~/plugins/firebase-auth.client.ts',
  ],
  /*
   ** Nuxt.js dev-modules
   */
  buildModules: [
    '@nuxt/typescript-build',
    [
      '@nuxtjs/dotenv',
      {
        systemvars: true,
        only: ['BASE_URL'],
      },
    ],
  ],
  /*
   ** Nuxt.js modules
   */
  modules: [
    // Doc: https://buefy.github.io/#/documentation
    [
      'nuxt-buefy',
      {
        defaultIconPack: 'fas',
        defaultIconComponent: 'fontawesome',
      },
    ],
    // Doc: https://axios.nuxtjs.org/usage
    [
      '@nuxtjs/axios',
      {
        proxy: true,
      },
    ],
    [
      '@nuxtjs/fontawesome',
      {
        component: 'fontawesome',
        icons: {
          solid: [
            'faUsers',
            'faCog',
            'faTag',
            'faSearch',
            'faChalkboardTeacher',
            'faCaretRight',
            'faCaretDown',
            'faCaretUp',
            'faList',
            'faAngleLeft',
            'faAngleRight',
            'faAngleDown',
            'faAngleUp',
            'faArrowDown',
            'faArrowUp',
            'faExclamationCircle',
          ],
          regular: ['faEdit'],
          brands: ['faGithub', 'faGoogle'],
        },
      },
    ],
    [
      'nuxt-mq',
      {
        // Default breakpoint for SSR
        defaultBreakpoint: 'sm',
        breakpoints: {
          sm: 500,
          md: 800,
          lg: Infinity,
        },
      },
    ],
    [
      '@nuxtjs/firebase',
      {
        config: JSON.parse(process.env.FIREBASE_CONFIG),
        services: {
          auth: true,
          storage: true,
        },
      },
    ],
  ],
  proxy: {
    '/api/': 'http://localhost:24000',
  },
  /*
   ** Build configuration
   */
  build: {
    /*
     ** You can extend webpack config here
     */
    extend(config) {
      // if (isServer) {
      config.resolve.alias.vue = 'vue/dist/vue.common'
      // }

      config.module.rules.push({
        test: /content\/.+\.md$/,
        use: {
          loader: 'raw-loader',
          options: {
            esModule: false,
          },
        },
      })
    },
  },
  env: {
    BASE_URL: process.env.BASE_URL,
  },
  generate: {
    crawler: false,
  },
}
