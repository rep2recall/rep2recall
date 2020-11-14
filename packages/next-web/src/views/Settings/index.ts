import 'firebase/auth'

import { api } from '@/assets/api'
import firebase from 'firebase/app'
import { Component, Vue } from 'vue-property-decorator'

@Component
export default class Settings extends Vue {
  baseURL = location.origin

  get user () {
    return this.$accessor.user
  }

  async newApiKey () {
    if (!this.user) {
      return
    }

    const { data } = await api.patch<{
      result: string;
    }>('/api/user/apiKey')

    this.$accessor.UPDATE_USER({
      ...this.user,
      apiKey: data.result
    })
  }

  async deleteUser () {
    await api.delete('/api/user')
    await firebase.auth().signOut()
  }
}
