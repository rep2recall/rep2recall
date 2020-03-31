<template lang="pug">
#app
  nav#main-nav(v-if="isDrawer")
    nav#icon-nav(style="margin-top: 1em;")
      router-link.flex-center-left-inline(to="/quiz")
        fontawesome(:icon="['far', 'question-circle']")
        span Quiz
      router-link.flex-center-left-inline(to="/edit")
        fontawesome(:icon="['far', 'edit']")
        span Edit
      router-link.flex-center-left-inline(to="/browse")
        fontawesome(icon="list")
        span Browse
      router-link.flex-center-left-inline(to="/settings")
        fontawesome(icon="cog")
        span Settings
      span.flex-center-left-inline(style="color: gray; cursor: not-allowed;")
        fontawesome(icon="users")
        span Community
      a.flex-center-left-inline(href="https://github.com/patarapolw/rep2recall" target="_blank" rel="noopener")
        fontawesome(:icon="['fab', 'github']")
        span About
    div(style="flex-grow: 1;")
    nav#icon-nav(style="margin-bottom: 0.5em;")
      a.flex-center-left-inline(v-if="user" @click="doLogout")
        figure.image.is-48x48(style="margin-left: 0.5em; margin-right: 1em;")
          img.is-rounded(:src="getGravatarUrl(user.email)" :alt="user.email")
        span {{user.email}}
      a.flex-center-left-inline(v-else role="button")
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
      router-view
  b-modal(:active.sync="isLoginModal" :can-cancel="false")
    div(ref="auth")
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator"
import firebase from 'firebase/app'
import { auth as authUI } from 'firebaseui'
import SparkMD5 from 'spark-md5'

import 'firebase/auth'
import 'firebaseui/dist/firebaseui.css'

let firebaseUI: authUI.AuthUI | null
declare const process: any

@Component
export default class App extends Vue {
  isDrawer = false
  isLoginModal = false

  get user () {
    return this.$store.state.user
  }

  mounted () {
    this.isDrawer = this.$mq === 'lg'
    if (!this.user) {
      this.isLoginModal = true
    }
  }

  @Watch('isLoginModal')
  onLogin () {
    this.$nextTick(() => {
      if (this.$refs.auth) {
        if (!firebaseUI) {
          firebaseUI = new authUI.AuthUI(firebase.auth())
        }

        firebaseUI.start(this.$refs.auth as HTMLDivElement, {
          signInSuccessUrl: (
            process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : 'https://rep2recall.herokuapp.com'
          ),
          signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
            // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
            // firebase.auth.GithubAuthProvider.PROVIDER_ID,
          ],
          signInFlow: 'popup'
        })
      }
    })
  }

  doLogout () {
    firebase.auth().signOut()
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
}

#main-nav {
  border-right: 1px solid lightgray;
  overflow: visible;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 250px;

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

  .arrow-up,
  .arrow-down {
    margin: 0 auto;
    margin-bottom: 1em;

    width: 0;
    height: 20px;
    border-left: 20px solid transparent;
    border-right: 20px solid transparent;

    animation: bounce 2s infinite;
  }

  .arrow-up {
    border-bottom: 15px solid gray;
  }

  .arrow-down {
    border-top: 15px solid gray;
  }

  @keyframes bounce {
    0%,
    20%,
    50%,
    80%,
    100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-10px);
    }
    60% {
      transform: translateY(-5px);
    }
  }
}

#main {
  display: flex;
  flex-direction: row;
  width: 100%;
}

@media screen and (max-width: 800px) {
  #main {
    flex-direction: column;
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

.flex-center-left-inline {
  display: flex;
  flex-direction: row;
  align-items: center;
}
</style>