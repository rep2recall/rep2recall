<template lang="pug">
.container
  .columns
    .column(:class="$mq === 'lg' ? 'is-10 is-offset-1' : ''")
      form.field(@submit.prevent="onSearch")
        label.label
          span Search
          b-tooltip(label="Click here to learn how-to" position="is-right")
            a.button.is-text(href="https://github.com/patarapolw/qsearch" target="_blank" style="font-size: 13px;") ?
        div.control.has-icons-left
          input.input(type="search" v-model="q" placeholder="Search..." @keydown.enter="onSearch")
          span.icon.is-small.is-left
            fontawesome(icon="search")
      .menu
        Treeview(:data="data")
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import { AxiosInstance } from 'axios'

import Treeview from '@/components/Treeview.vue'

@Component({
  components: {
    Treeview
  }
})
export default class Quiz extends Vue {
  data = []
  q = ''

  mounted () {
    this.load()
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  async load (silent?: boolean) {
    const api = await this.getApi(silent)
    const data = (await api.post('/api/quiz/', { q: this.q })).data
    console.log(data)
    this.$set(this, 'data', data)
  }

  @Watch('$route.query.q')
  async loadSpinning () {
    return this.load()
  }

  onSearch () {
    this.$router.push({
      path: '/quiz',
      query: {
        q: this.q
      }
    })
  }
}
</script>
