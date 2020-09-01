import Vue from 'vue'
import { LoadingProgrammatic } from 'buefy'

import App from './App.vue'
import router from './router'
import store from './store'
import { initDatabase, loki } from './assets/db'

import './plugins/buefy'

Vue.config.productionTip = false

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let app: Vue | null = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const loading = LoadingProgrammatic.open({})

initDatabase().then(() => {
  loading.close()

  const col = loki.getCollection('hello') || loki.addCollection('hello')
  col.insertOne({ hello: col.count() })

  alert(col.count())

  app = new Vue({
    router,
    store,
    render: h => h(App)
  }).$mount('#app')
}).catch(console.error)
