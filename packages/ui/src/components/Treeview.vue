<template lang="pug">
ul.menu-list
  li(v-for="it in decksAtThisLevel" :key="it.deck")
    a
      .caret(@click="open[it.deck] = !open[it.deck]")
        span(v-if="subDecks(it.deck).length > 0")
          fontawesome(v-if="open[it.deck]" icon="caret-down")
          fontawesome(v-else icon="caret-right")
      b-tooltip(:label="it.hasReview ? 'Review pending' : ''")
        span(role="button" @click="handler.quiz(it.deck)") {{it.ds[depth]}}
      div(style="flex-grow: 1;")
      DueScore(
        :is-tip="!hasTreeview(it.deck)"
        :data="data" :deck="it.deck" :exact="open[it.deck]" @has-review="it.hasReview = $event"
      )
    Treeview(v-if="open[it.deck] && hasTreeview(it.deck)" :data="subDecks(it.deck)" :depth="depth + 1" :handler="handler")
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
  @Prop({ required: true }) handler!: any
  @Prop({ default: 0 }) depth!: number

  open = this.decksAtThisLevel.reduce((prev, { deck }) => ({ ...prev, [deck]: this.depth < 3 }), {})

  get decksAtThisLevel () {
    const subData = {} as any

    this.data
      .map((d) => ({
        ...d,
        ds: d.deck.split('/')
      }))
      .filter(({ ds }) => ds.length >= this.depth + 1)
      .map((it) => {
        const deck = it.ds.slice(0, this.depth + 1).join('/')

        if (!subData[deck]) {
          subData[deck] = {
            ...it,
            hasReview: false,
            deck
          }
        }
      })
    
    return Object.entries(subData).sort(([a], [b]) => a.localeCompare(b)).map(([_, v]) => v) as any[]
  }

  mounted () {
    this.$forceUpdate()
  }

  subDecks (deck: string) {
    return this.data.filter(it => it.deck.startsWith(`${deck}/`))
  }

  hasTreeview (deck: string) {
    return this.subDecks(deck).length > 0
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
