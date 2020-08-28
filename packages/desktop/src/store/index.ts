import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: () => ({
    isReady: false
  }),
  mutations: {
    SET_READY (state, b: boolean) {
      state.isReady = b
    }
  },
  actions: {
  },
  modules: {
  }
})
