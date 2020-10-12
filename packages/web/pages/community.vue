<template lang="pug">
section
  .card
    .card-header
      h1.card-header-title Shared decks
    .card-content
      .columns(style="flex-flow: wrap;")
        .column.is-6(v-for="ls in lessons" :key="ls.key")
          .card
            .card-header
              h2.card-header-title {{ls.name}}
              a.button.is-success Download
            .card-content
              .content(v-html="ls.description")
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'

@Component({
  layout: 'dashboard'
})
export default class Community extends Vue {
  lessons: {
    key: string
    name: string
    description?: string
  }[] = [
    {
      key: 'hsk',
      name: 'HSK',
      description:
        'A curated list of vocabularies for HSK Level 1-6, divided into 60 levels.'
    },
    {
      key: 'news',
      name: 'News',
      description: 'Vocabularies according to current news.'
    },
    {
      key: 'categories',
      name: 'Categories',
      description: 'Vocabularies for common categories, such as animal.'
    },
    {
      key: 'thailand',
      name: 'Thailand',
      description: 'Vocabularies related to Thailand.'
    }
  ]
}
</script>

<style lang="scss" scoped>
.card-header .button {
  align-self: center;
  margin-right: 1em;
}
</style>
