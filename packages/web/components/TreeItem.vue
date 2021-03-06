<template lang="pug">
li
  a
    .caret(@click="open = !open")
      span(v-if="subDecks.length > 0")
        fontawesome(v-if="open[deck]" icon="caret-down")
        fontawesome(v-else icon="caret-right")
    b-tooltip(:label="hasReview ? 'Review pending' : ''")
      span(role="button" @click="handler.quiz(deck)") {{name}}
    div(role="button" @click="handler.quiz(deck)" style="flex-grow: 1;")
    div(role="button" @click="handler.quiz(deck)")
      DueScore(
        :is-tip="!hasTreeview"
        :data="data" :deck="deck" :exact="open" @has-review="hasReview = $event"
    )
  Treeview(v-if="open && hasTreeview" :data="subDecks" :depth="depth + 1" :handler="handler")
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'nuxt-property-decorator'

import DueScore from './DueScore.vue'

@Component({
  components: {
    DueScore,
    Treeview: () => import('./Treeview.vue'),
  },
})
export default class TreeItem extends Vue {
  @Prop({ required: true }) deck!: string
  @Prop({ required: true }) data!: any[]
  @Prop({ required: true }) handler!: any
  @Prop({ default: 0 }) depth!: number

  open = this.depth < 2
  hasReview = false

  get name() {
    return this.deck.split('/')[this.depth]
  }

  get hasTreeview() {
    return this.subDecks.length > 0
  }

  get subDecks() {
    return this.data.filter((it) => it.deck.startsWith(`${this.deck}/`))
  }

  get directSubDecks() {
    return this.data.filter((it) => {
      return (
        it.deck.startsWith(`${this.deck}/`) &&
        !it.deck.substr(`${this.deck}/`.length).includes('/')
      )
    })
  }

  mounted() {
    this.open = this.depth < 2 && this.directSubDecks.length < 7
  }
}
</script>

<style lang="scss">
.menu-list {
  .caret {
    display: inline-flex;
    width: 1rem;
    height: 1rem;
    align-content: center;
    justify-content: center;
    margin-right: 0.3rem;
  }

  a {
    display: flex;
  }

  li ul {
    margin: 0;
    margin-left: 1.2rem;
  }
}
</style>
