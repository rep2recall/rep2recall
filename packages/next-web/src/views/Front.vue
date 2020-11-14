<template>
  <v-container>
    <v-card>
      <v-card-text>
        <h2 class="mb-4">Login to Rep2recall</h2>
        <div id="firebaseui"></div>

        <h2 class="mb-4">Features</h2>
        <center>
          <img src="https://thumbs.gfycat.com/ChillyHospitableBison-size_restricted.gif" alt="screenshot">
        </center>
        <ul>
          <li>
            Full range of JavaScript/CSS/HTML as supported by latest web browsers
          </li>
          <li>
            Internally and externally linked
            <a href="https://ejs.co/" target="_blank" rel="noopener noreferrer">
              EJS templates
            </a>
          </li>
          <li>
            Online first, with
            <a href="/api/doc" target="_blank" rel="noopener noreferrer">
              exposed OpenAPI
            </a>
          </li>
        </ul>
      </v-card-text>
    </v-card>

  </v-container>
</template>

<script lang="ts" src="./Front/index.ts"></script>

<style lang="scss" scoped>
.v-card {
  margin: 0 auto;
  max-width: 600px;
}
</style>
