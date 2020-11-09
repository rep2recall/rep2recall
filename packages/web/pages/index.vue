<template lang="pug">
.columns
  .column.is-8-desktop.is-offset-2-desktop(style="margin-top: 1em;")
    Markdown(v-if="$fireAuthObj" :content="require('@/content/home.md')" :ctx="{ doLogin }")
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import Markdown from '@/components/Markdown.vue'

@Component({
  components: {
    Markdown,
  },
  middleware(ctx) {
    if (!process.env.IS_FIREBASE) {
      ctx.redirect('/quiz')
    }
  },
  computed: {
    doLogin() {
      return async () => {
        if (process.client) {
          try {
            if (!this.$store.state.user.user) {
              const provider = new this.$fireAuthObj.GoogleAuthProvider()
              await this.$fireAuth.signInWithPopup(provider)
            }
            this.$router.push('/lesson')
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e)
          }
        }
      }
    },
  },
})
export default class Home extends Vue {}
</script>
