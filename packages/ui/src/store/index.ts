import Vue from 'vue'
import Vuex from 'vuex'
import axios from 'axios'
import { User } from 'firebase/app'
import { SnackbarProgrammatic as Snackbar, LoadingProgrammatic as Loading } from 'buefy'

Vue.use(Vuex)

let loading: {
  close(): any
  requestEnded?: boolean
} | null = null
let requestTimeout: NodeJS.Timeout | null = null

const store = new Vuex.Store({
  state: {
    user: null as User | null,
  },
  mutations: {
    setUser (state, user) {
      state.user = user
    },
    removeUser (state) {
      state.user = null
    },
  },
  actions: {
    async getApi ({ state }, silent = false) {
      const api = axios.create()

      if (state.user) {
        api.defaults.headers.Authorization = `Bearer ${await state.user.getIdToken()}`
      }

      if (!silent) {
        api.interceptors.request.use((config) => {
          if (!loading) {
            if (requestTimeout) {
              clearTimeout(requestTimeout)
              requestTimeout = null
            }

            requestTimeout = setTimeout(() => {
              if (!loading) {
                loading = Loading.open({
                  isFullPage: true,
                  canCancel: true,
                  onCancel: () => {
                    if (loading && !loading.requestEnded) {
                      Snackbar.open('API request is loading in background.')
                    }
                  },
                })
              }
            }, 1000)
          }

          return config
        })

        api.interceptors.response.use((config) => {
          if (loading) {
            loading.requestEnded = true
            loading.close()
            loading = null
          }

          if (requestTimeout) {
            clearTimeout(requestTimeout)
            requestTimeout = null
          }

          return config
        }, (err) => {
          if (loading) {
            loading.close()
            loading = null
          }

          if (requestTimeout) {
            clearTimeout(requestTimeout)
            requestTimeout = null
          }

          Snackbar.open(err.message)
          return err
        })
      }

      return api
    },
  },
})

export default store
