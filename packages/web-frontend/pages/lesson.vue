<template lang="pug">
section
  .card(style="width: 100%;")
    .card-header
      h1.card-header-title Lessons
    .card-content
      .columns(style="flex-flow: wrap;")
        .column.is-6(v-for="ls in lessons" :key="ls.key")
          .card
            .card-header.u-cursor-pointer(
              @contextmenu.prevent="(evt) => { selectedLesson = ls.key; $refs.contextmenu.open(evt) }"
            )
              h2.card-header-title.u-hover-blue {{ls.name}}
              nuxt-link.button.is-success(:to="{ path: '/quiz', query: { id: ls.id } }") Start
            .card-content
              .content(v-html="ls.description")
  vue-context(ref="contextmenu")
    li
      a(@click="exportLesson") Export lesson
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component({
  layout: 'dashboard'
})
export default class Lesson extends Vue {
  lessons: {
    key: string
    name: string
    description?: string
  }[] = []

  selectedLesson = ''

  created() {
    this.load()
  }

  async load() {
    const { entries } = await this.$axios.$get('/api/quiz/lessons')
    entries.push({
      id: '',
      name: 'Default',
      description:
        'Entries outside lessons will be here. Usually, user-created entries.'
    })

    this.$set(this, 'lessons', entries)
  }

  exportLesson() {}
}
</script>

<style lang="scss" scoped>
.card-header .button {
  align-self: center;
  margin-right: 1em;
}
</style>
