<template>
  <div id="app">
    <b-sidebar overlay fullheight v-model="isDrawer"></b-sidebar>

    <nav>
      <b-button class="hamburger" @click="isDrawer = true">
        <b-icon icon="bars"></b-icon>
      </b-button>

      <div class="flex-grow-1"></div>

      <b-field
        class="is-rounded"
        @submit.prevent="doSearch"
      >
        <b-input
          v-model="q"
          placeholder="Type and enter to search"
          icon="search"
          type="search"
        ></b-input>
        <p class="control">
          <button class="button is-secondary">Search</button>
        </p>
      </b-field>
    </nav>

    <main>
      <router-view></router-view>
    </main>
  </div>
</template>

<script lang="ts" src="./app/index.ts"></script>

<style lang="scss" scoped>
$nav-height: 60px;

#app {
  width: 100%;
  height: 100%;
}

nav {
  padding-left: 0.5rem;
  padding-right: 1rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  position: fixed;
  height: $nav-height;
  width: 100vw;
  background-color: rgb(0, 110, 255);
}

button {
  background-color: rgba(255, 255, 255, 0.5);
  border: none;
}

main {
  position: absolute;
  top: $nav-height;
}
</style>
