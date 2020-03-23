<template lang="pug">
#app
  nav#main-nav(:style="{ width: $mq === 'lg' ? 'auto' : '0' }")
    nav#sub-nav
      nav#icon-nav(v-if="isNavShown")
        b-tooltip(label='Quiz' position="is-right")
          router-link(to="/quiz")
            fontawesome(:icon="['far', 'question-circle']")
        b-tooltip(label='Edit' position="is-right")
          router-link(to="/edit")
            fontawesome(:icon="['far', 'edit']")
        b-tooltip(label='Edit' position="is-right")
          router-link(to="/browse")
            fontawesome(icon="list")
        b-tooltip(label='Import' position="is-right")
          router-link(to="/import")
            fontawesome(icon="file-import")
        b-tooltip(label='Community' position="is-right")
          router-link(to="/community")
            fontawesome(icon="users")
        b-tooltip(label='Settings' position="is-right")
          router-link(to="/settings")
            fontawesome(icon="cog")
      div(style="flex-grow: 1;")
      nav#icon-nav
        nav(v-if="$mq !== 'lg'" role="button" @click="isNavShown = !isNavShown")
          .arrow-up(v-if="!isNavShown")
          .arrow-down(v-else)
        b-tooltip(label='Login' position="is-right")
          router-link(to="/login")
            fontawesome(icon="user")
  #main-view
    router-view
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";

@Component
export default class App extends Vue {
  isNavShown = this.$mq === "lg";

  @Watch("$mq")
  setNavShown() {
    this.isNavShown = this.$mq === "lg";
  }
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

  nav {
    display: flex;
    flex-direction: column;
  }

  #sub-nav {
    width: 70px;
    flex-grow: 1;
  }

  #icon-nav {
    background-color: rgba(255, 255, 255, 0.75);
  }

  .svg-inline--fa {
    $size: 50px;

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
</style>