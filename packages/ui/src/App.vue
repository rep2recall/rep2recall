<template lang="pug">
#app
  nav#main-nav
    b-tooltip(label='Quiz' position="is-right")
      router-link(to="/quiz")
        fontawesome(:icon="['far', 'question-circle']")
    b-tooltip(label='Edit' position="is-right")
      router-link(to="/edit")
        fontawesome(:icon="['far', 'edit']")
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
    b-tooltip(label='Login' position="is-right")
      router-link(to="/login")
        fontawesome(icon="user")
  #main-view
    router-view
</template>

<style lang="scss">
html, body, #app {
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
  display: flex;
  flex-direction: column;

  .svg-inline--fa {
    $size: 50px;

    width: $size;
    height: $size;
    margin: 10px;
    align-self: center;
  }
}

#main-view {
  flex-grow: 1;
}
</style>