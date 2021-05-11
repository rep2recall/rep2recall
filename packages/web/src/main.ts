import './registerServiceWorker'
import './main.scss'

import Vue from 'vue'

import App from './App.vue'
import { api, initAPI } from './assets/api'
import vuetify from './plugins/vuetify'
import router from './router'
import store, { IUser, accessor } from './store'

async function main() {
  if (await initAPI()) {
    const { data } = await api.get<IUser>('/api/user', {
      params: {
        select: 'name,email,image,apiKey'
      }
    })

    accessor.UPDATE_USER(data)
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
