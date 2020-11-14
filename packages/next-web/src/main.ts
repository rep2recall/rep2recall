import 'firebase/analytics'
import 'firebase/auth'

import './registerServiceWorker'
import './main.scss'

import firebase from 'firebase/app'
import Vue from 'vue'

import App from './App.vue'
import { api } from './assets/api'
import vuetify from './plugins/vuetify'
import router from './router'
import store, { IUser, accessor } from './store'

declare global {
  // eslint-disable-next-line @typescript-eslint/interface-name-prefix
  interface Window {
    FIREBASE_CONFIG: string;
  }
}

async function main () {
  if (window.FIREBASE_CONFIG && !window.FIREBASE_CONFIG.startsWith('{{')) {
    firebase.initializeApp(JSON.parse(window.FIREBASE_CONFIG))
    firebase.analytics()

    let isFirebaseInit = false
    await new Promise((resolve) => {
      firebase.auth().onAuthStateChanged(async (user) => {
        api.defaults.headers = api.defaults.headers || {}
        if (user) {
          api.defaults.headers.Authorization = `Bearer ${await user.getIdToken()}`
          const { data } = await api.get<IUser>('/api/user', {
            params: {
              select: 'name,email,image,apiKey'
            }
          })

          accessor.UPDATE_USER(data)
        } else {
          delete api.defaults.headers.Authorization
          accessor.UPDATE_USER(null)
        }

        if (!isFirebaseInit) {
          resolve()
          isFirebaseInit = true
        }
      })
    })
  } else {
    window.FIREBASE_CONFIG = ''
  }

  Vue.config.productionTip = false

  new Vue({
    router,
    store,
    vuetify,
    render: (h) => h(App)
  }).$mount('#app')
}

main()
