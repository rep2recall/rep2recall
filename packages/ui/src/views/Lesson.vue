<template lang="pug">
section
  .card
    .card-header
      h1.card-header-title Lessons
    .card-content
      .columns(style="flex-flow: wrap;")
        .column.is-6(v-for="ls in lessons" :key="ls.key")
          .card
            .card-header
              h2.card-header-title {{ls.name}}
              router-link.button.is-success(:to="'/quiz/' + ls.key") Start
            .card-content
              .content(v-html="ls.description")
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import { AxiosInstance } from 'axios'

@Component
export default class Lesson extends Vue {
  lessons: {
    key: string
    name: string
    description?: string
  }[] = []

  created () {
    this.load()
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  async load () {
    const api = await this.getApi()
    const { data } = await api.get('/api/quiz/lessons')
    data.entries.push({
      key: '_',
      name: 'Default',
      description: 'User created entries will be here.'
    })

    this.$set(this, 'lessons', data.entries)
  }
}
</script>

<style lang="scss" scoped>
.card-header .button {
  align-self: center;
  margin-right: 1em;
}
</style>
