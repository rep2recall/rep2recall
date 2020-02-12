<template lang="pug">
ul.menu-list
  li(v-for="it in decksAtThisLevel" :key="it.deck")
    div(v-if="subDecksExists(it.deck)")
      a
        .caret(@click="open = !open")
          fontawesome(v-if="open" icon="caret-down")
          fontawesome(v-else icon="caret-right")
        b-tooltip(:label="it.hasReview ? 'Review pending' : ''")
          span {{it.deck.split('/')[depth]}}
        div(style="flex-grow: 1;")
        DueScore(:data="data" :deck="it.deck" :exact="open" @has-review="$set(it, 'hasReview', $event)")
      Treeview(v-if="open" :data="data" :depth="depth + 1")
    div(v-else)
      a
        .caret
        b-tooltip(:label="it.hasReview ? 'Review pending' : ''")
          span {{it.deck.split('/')[depth]}}
        div(style="flex-grow: 1;")
        DueScore(:data="data" :deck="it.deck" @has-review="$set(it, 'hasReview', $event)")
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'

import DueScore from './DueScore.vue'

@Component({
  name: 'Treeview',
  components: {
    DueScore
  }
})
export default class Treeview extends Vue {
  @Prop({ required: true }) data!: any[]
  @Prop({ default: 0 }) depth!: number

  open = true

  get decksAtThisLevel () {
    const subData = this.data
      .filter(it => it.deck.split('/').length >= this.depth + 1)
      .map(it => {
        return {
          ...it,
          deck: it.deck.split('/').slice(0, this.depth + 1).join('/')
        }
      })
    
    const decks = subData.map(it => it.deck)
    
    return subData.filter((it, i) => decks.indexOf(it.deck) === i)
  }

  subDecksExists (deck: string) {
    return this.data
      .filter(it => it.deck.startsWith(`${deck}/`))
      .length > 0
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
