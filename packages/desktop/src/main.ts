import Vue from 'vue'

import App from './App.vue'
import router from './router'
import store from './store'
import { initDatabase, loki } from './assets/db'

import './plugins/buefy'

Vue.config.productionTip = false

initDatabase().then(() => {
  store.commit('SET_READY', true)
  new Vue({
    router,
    store,
    render: h => h(App)
  }).$mount('#app')
}).catch(console.error)

window.onbeforeunload = (e: Event) => {
  if (loki) {
    e.preventDefault()
    e.returnValue = true

    loki.close(() => {
      window.onbeforeunload = null
      window.close()
    })
  }
}
