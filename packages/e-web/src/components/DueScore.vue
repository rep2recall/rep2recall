<template lang="pug">
.due-score(v-if="isTip || totalCount > 0")
  b-tooltip(label="Leech")
    .count(style="color: red;") {{count('leech') | format}}
  b-tooltip(label="Due")
    .count(style="color: blue;") {{count('due') | format}}
  b-tooltip(label="New")
    .count(style="color: green;") {{count('new') | format}}
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from 'vue-property-decorator'

@Component
export default class DueScore extends Vue {
  @Prop({ required: true }) data!: any[]
  @Prop({ required: true }) deck!: string
  @Prop({ default: false }) exact!: string
  @Prop({ required: true }) isTip!: boolean

  get decksOrSubDecks () {
    return this.data
      .filter((it) => (this.exact ? false : it.deck.startsWith(`${this.deck}/`)) || it.deck === this.deck)
  }

  get totalCount () {
    return this.count('leech') + this.count('due') + this.count('new')
  }

  get dueCount () {
    return this.count('due')
  }

  mounted () {
    this.checkHasReview()
  }

  @Watch('dueCount')
  checkHasReview () {
    this.$emit('has-review', this.count('due') > 0)
  }

  count (key: string) {
    return this.decksOrSubDecks.map((it) => it[key]).reduce((acc, c) => acc + c, 0) as number
  }
}
</script>

<style lang="scss">
.due-score {
  display: flex;

  .count {
    display: inline-flex;
    width: 3rem;
    direction: rtl;
  }
}
</style>
