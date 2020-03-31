import Vue from 'vue'
import dayjs from 'dayjs'
import firebase from 'firebase/app'

import 'firebase/analytics'
import 'firebase/auth'

import App from './App.vue'
import router from './router'
import store from './store'
import firebaseConfig from '../firebase.config.js'

import './plugins/buefy'
import './plugins/fontawesome'
import './plugins/mq'
import './plugins/codemirror'

firebase.initializeApp(firebaseConfig)

Vue.config.productionTip = false

Vue.filter('nonZero', (v: any) => {
  return v === 0 ? '' : v
})

Vue.filter('format', (v: any) => {
  if (typeof v === 'number') {
    return (v || v === 0) ? v.toLocaleString() : ''
  } else if (v instanceof Date) {
    return dayjs(v).format('YYYY-MM-DD HH:mm')
  } else if (v && typeof v === 'object') {
    return JSON.stringify(v)
  }
  return v
})

Vue.filter('formatDate', (v: any) => {
  return dayjs(v).format('YYYY-MM-DD HH:mm')
})

let isAuthReady = false

firebase.auth().onAuthStateChanged((user) => {
  store.commit('setUser', user)

  if (!isAuthReady) {
    isAuthReady = true
    new Vue({
      router,
      store,
      render: (h) => h(App),
    }).$mount('#app')
  }
})
