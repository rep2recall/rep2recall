<template lang="pug">
section
  b-loading(v-if="!isAuthReady" active :can-cancel="false")
  nav#main-nav(v-if="isAuthReady && isDrawer")
    nav#icon-nav(style="margin-top: 1em;")
      nuxt-link.nav-link(to="/lesson" :class="{ active: $route.path === '/lesson' }")
        fontawesome(icon="chalkboard-teacher")
        span Lesson
      nuxt-link.nav-link(to="/edit" :class="{ active: $route.path === '/edit' }")
        fontawesome(:icon="['far', 'edit']")
        span Edit
      nuxt-link.nav-link(to="/browse" :class="{ active: $route.path === '/browse' }")
        fontawesome(icon="list")
        span Browse
      nuxt-link.nav-link(to="/settings" :class="{ active: $route.path === '/settings' }")
        fontawesome(icon="cog")
        span Settings
      nuxt-link.nav-link(to="/community" :class="{ active: $route.path === '/community' }")
        fontawesome(icon="users")
        span Community
      a.nav-link(href="https://github.com/patarapolw/rep2recall" target="_blank" rel="noopener")
        fontawesome(:icon="['fab', 'github']")
        span About
    div(style="flex-grow: 1;")
    nav#icon-nav(style="margin-bottom: 0.5em;")
      b-tooltip(label="Click to logout")
        a.nav-link(@click="doLogout")
          figure.image.is-48x48(style="margin-left: 0.5em; margin-right: 1em;")
            img.is-rounded(:src="getGravatarUrl(user.email)" :alt="user.email")
          span {{user.email}}
  main#main(v-if="isAuthReady")
    #burger
      a.navbar-burger(
        :class="{ 'is-active': isDrawer }" @click="isDrawer = !isDrawer"
      )
        span
        span
        span
    #main-view
      client-only
        nuxt
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'nuxt-property-decorator'
import SparkMD5 from 'spark-md5'

@Component
export default class App extends Vue {
  isDrawer = false

  get user() {
    return this.$store.state.user.user
  }

  get isAuthReady() {
    return this.$store.state.user.isAuthReady
  }

  created() {
    this.onResize()
  }

  @Watch('$mq')
  onResize() {
    // @ts-ignore
    this.isDrawer = this.$mq === 'lg'
  }

  doLogout() {
    this.$buefy.dialog.confirm({
      message: 'Are you sure you want to logout?',
      type: 'is-danger',
      hasIcon: true,
      onConfirm: async () => {
        await this.$fireAuth.signOut()
        this.$router.push('/')
      },
    })
  }

  getGravatarUrl(email: string) {
    return `https://www.gravatar.com/avatar/${SparkMD5.hash(
      email.trim().toLocaleLowerCase()
    )}?d=mp`
  }
}
</script>

<style lang="scss" scoped>
section:first-child {
  width: 100%;
  height: 100%;
  display: flex;
  overflow-x: clip;

  #main-nav {
    border-right: 1px solid lightgray;
    overflow: visible;
    z-index: 10;
    display: flex;
    flex-direction: column;
    width: 300px;

    nav {
      display: flex;
      flex-direction: column;
    }

    #icon-nav {
      background-color: rgba(255, 255, 255, 0.75);
    }

    .svg-inline--fa {
      $size: 30px;

      width: $size;
      height: $size;
      margin: 10px;
      align-self: center;
    }

    .nav-link {
      display: flex;
      flex-direction: row;
      align-items: center;

      &.active {
        background-color: #eee;
      }
    }
  }

  #main {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100vh;
    overflow: scroll;
  }

  @media screen and (max-width: 800px) {
    #main {
      flex-direction: column;
      min-width: 100vw;
    }
  }

  #burger {
    display: flex;

    > .navbar-burger {
      margin-left: unset;
      display: block !important;
    }
  }

  #main-view {
    flex-grow: 1;
    margin-left: 1em;
    margin-right: 1em;
  }
}
</style>
