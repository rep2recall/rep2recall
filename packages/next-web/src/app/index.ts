import 'firebase/auth'

import { api } from '@/assets/api'
import { ITag } from '@/store'
import firebase from 'firebase/app'
import { Component, Vue } from 'vue-property-decorator'

@Component<App>({
  watch: {
    user () {
      this.loadUser()
    },
    '$route.path' () {
      if (this.$route.path === '/') {
        this.isDrawer = false
      }
    }
  },
  created () {
    this.loadUser()
    this.q = this.$accessor.q

    this.loadPreset().finally(() => {
      this.isReady = true
    })
  }
})
export default class App extends Vue {
  isReady = false
  isDrawer = false
  isTagOpen = true
  isEdited = false
  q = ''

  get user () {
    return this.$accessor.user
  }

  doSearch () {
    this.$accessor.UPDATE_Q(this.q)
  }

  doLoad (id: string) {
    this.$router.push({
      path: '/quiz',
      query: {
        id
      }
    })
  }

  doDelete (id: string) {
    this.$accessor.REMOVE_TAGS(id)
  }

  loadUser () {
    // console.log(this.$route)

    if (!this.user) {
      if (this.$route.path !== '/') {
        this.$router.push('/')
      }
    } else {
      if (this.$route.path === '/') {
        this.$router.push('/quiz')
      }
    }
  }

  async loadPreset () {
    try {
      await api.get('/api/preset', {
        params: {
          select: 'id'
        }
      })
    } catch (e) {
      await api.put('/api/preset', {
        id: '',
        q: this.q,
        name: 'Default',
        selected: [''],
        opened: [''],
        status: {
          new: true,
          due: true,
          leech: true,
          graduated: false
        }
      })
    }

    const { data } = await api.get<{
      result: ITag[];
    }>('/api/preset/all')

    data.result.map((t) => {
      this.$accessor.UPDATE_TAGS({
        ...t,
        canDelete: !!t.id
      })
    })
  }

  signOut () {
    firebase.auth().signOut()
  }
}
