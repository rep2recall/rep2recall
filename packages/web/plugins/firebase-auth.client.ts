import { Plugin } from '@nuxt/types'

const onInit: Plugin = ({ app }) => {
  if (app.$fireAuth) {
    app.$fireAuth.onAuthStateChanged((user) => {
      if (app.store) {
        app.store.dispatch('user/updateUser', user)
      }
    })
  }
}

export default onInit
