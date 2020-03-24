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
      router-link.flex-center-left-inline(to="/community")
        fontawesome(icon="users")
        span Community
    div(style="flex-grow: 1;")
    nav#icon-nav
      nav(v-if="$mq !== 'lg'" role="button" @click="isNavShown = !isNavShown")
        .arrow-up(v-if="!isNavShown")
        .arrow-down(v-else)
      router-link.flex-center-left-inline(to="/login")
        fontawesome(icon="user-slash")
        span Not Logged In
  #burger
    a.navbar-burger(
      :class="{ 'is-active': isDrawer }" @click="isDrawer = !isDrawer"
      style="display: block !important;" 
    )
      span
      span
      span
  #main-view
    router-view
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator"

@Component
export default class App extends Vue {
  isDrawer = true
}
</script>

<style lang="scss">
html,
body,
#app {
  box-sizing: border-box;
  overscroll-behavior: none;
}

#app {
  width: 100vw;
  height: 100vh;
  display: flex;
}

#main-nav {
  border-right: 1px solid lightgray;
  overflow: visible;
  z-index: 100;
  display: flex;
  flex-direction: column;
  width: 200px;

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