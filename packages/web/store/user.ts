// eslint-disable-next-line import/order
import { RootState } from '~/store'
import { User } from 'firebase/app'
import { ActionTree, MutationTree } from 'vuex'

export const state = () => ({
  user: null as User | null,
  isAuthReady: false,
})

export type UserModuleState = ReturnType<typeof state>

export const mutations: MutationTree<UserModuleState> = {
  updateUser(state, { user }) {
    state.user = user
    state.isAuthReady = true
  },
}

export const actions: ActionTree<UserModuleState, RootState> = {
  async updateUser({ commit }, newUser: User | null) {
    const user = JSON.parse(JSON.stringify(newUser))
    let apiKey = ''

    this.$axios.defaults.headers = this.$axios.defaults.headers || {}

    if (newUser) {
      apiKey = await newUser.getIdToken()
      this.$axios.defaults.headers.common.Authorization = `Bearer ${apiKey}`
    } else if (this.$axios.defaults.headers.common.Authorization) {
      await this.$axios.$delete('/api/user/')
      delete this.$axios.defaults.headers.common.Authorization
    }

    commit('updateUser', { user })
  },
}
