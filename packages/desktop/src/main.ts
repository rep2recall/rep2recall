import Vue from 'vue'

import App from './App.vue'
import router from './router'
import store from './store'
import { initNeutralino, initDatabase } from './assets/db'

import './plugins/buefy'

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')

initNeutralino().then((neu) => {
  store.commit('SET_READY', true)
  return initDatabase(neu)
}).catch(console.error)

// window.onbeforeunload = (e: Event) => {
//   if (loki) {
//     e.preventDefault()
//     e.returnValue = true

//     let col = loki.getCollection('hello')
//     if (!col) {
//       col = loki.addCollection('hello')
//     }
//     col.insertOne({ hello: col.count() })
//     console.log(col.count())

//     loki.close(() => {
//       window.onbeforeunload = null
//       window.close()
//     })
//   }
// }
