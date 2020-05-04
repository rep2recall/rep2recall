<template lang="pug">
#app
  nav#main-nav(v-if="isDrawer")
    nav#icon-nav(style="margin-top: 1em;")
      router-link.nav-link(to="/lesson" :class="{ active: $route.path === '/lesson' }")
        fontawesome(icon="chalkboard-teacher")
        span Lesson
      router-link.nav-link(to="/edit" :class="{ active: $route.path === '/edit' }")
        fontawesome(:icon="['far', 'edit']")
        span Edit
      router-link.nav-link(to="/browse" :class="{ active: $route.path === '/browse' }")
        fontawesome(icon="list")
        span Browse
      router-link.nav-link(to="/settings" :class="{ active: $route.path === '/settings' }")
        fontawesome(icon="cog")
        span Settings
      router-link.nav-link(to="/community" :class="{ active: $route.path === '/community' }")
        fontawesome(icon="users")
        span Community
      a.nav-link(href="https://github.com/patarapolw/rep2recall" target="_blank" rel="noopener")
        fontawesome(:icon="['fab', 'github']")
        span About
    div(style="flex-grow: 1;")
    nav#icon-nav(style="margin-bottom: 0.5em;")
      a.nav-link(v-if="user" @click="doLogout")
        figure.image.is-48x48(style="margin-left: 0.5em; margin-right: 1em;")
          img.is-rounded(:src="getGravatarUrl(user.email)" :alt="user.email")
        span {{user.email}}
      a.nav-link(v-else role="button" @click="isLoginModal = true")
        fontawesome(icon="user-slash")
        span Not Logged In
  main#main
    #burger
      a.navbar-burger(
        :class="{ 'is-active': isDrawer }" @click="isDrawer = !isDrawer"
      )
        span
        span
        span
    #main-view
      slot
</template>

<script lang="ts">
import { Vue, Component, Watch } from 'vue-property-decorator'
import firebase from 'firebase/app'
import SparkMD5 from 'spark-md5'
import { AxiosInstance } from 'axios'

import 'firebase/auth'

declare const process: any

@Component
export default class App extends Vue {
  isDrawer = false

  get user () {
    return this.$store.state.user
  }

  get isAuthenticated () {
    return this.$store.state.lastStatus !== 401
  }

  created () {
    this.onResize()
  }

  @Watch('$mq')
  onResize () {
    this.isDrawer = this.$mq === 'lg'
  }

  async getApi (silent?: boolean) {
    return await this.$store.dispatch('getApi', silent) as AxiosInstance
  }

  async doLogout () {
    firebase.auth().signOut()
    const api = await this.getApi()
    api.delete('/api/user/logout')
  }

  getGravatarUrl (email: string) {
    return `https://www.gravatar.com/avatar/${SparkMD5.hash(email.trim().toLocaleLowerCase())}?d=mp`
  }
}
</script>

<style lang="scss">
html,
body,
#app {
  box-sizing: border-box;
  /* overscroll-behavior: none; */
}

#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  overflow-x: clip;
}

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
</style>
