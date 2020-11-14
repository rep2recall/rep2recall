<template>
  <v-container class="Settings">
    <v-card class="mx-auto my-4">
      <v-card-title>API key</v-card-title>

      <v-card-text>
        <p>
          API key is <code> {{ user.apiKey }} </code>.
        </p>

        <p>
          You can access the public API at
          <a href="/api/doc" target="_blank" rel="noopener noreferrer">
            {{ baseURL }}/api/doc
          </a>
          , using
          <a href="https://swagger.io/docs/specification/authentication/basic-authentication/" target="_blank" rel="noopener noreferrer">
            Basic Authentication
          </a> as base64-encoded
          <code>
            {{ user.email }}
            :$apiKey
          </code>.
        </p>

        <v-btn @click="newApiKey">
          Regenerate API key
        </v-btn>
      </v-card-text>
    </v-card>

    <v-card v-if="user.email" class="mx-auto my-4 danger-zone">
      <v-card-title>Danger zone</v-card-title>

      <v-card-text>
        <v-dialog width="500">
          <template v-slot:activator="{ on, attrs }">
            <v-btn v-bind="attrs" v-on="on" color="red">
              DELETE my account
            </v-btn>
          </template>

          <v-card>
            <v-card-title>
              Delete confirmation
            </v-card-title>

            <v-card-text>
              Are you sure you want to delete your account? (You will be signed out automatically.)
            </v-card-text>

            <v-card-action>
              <v-btn text block color="red" @click="deleteUser">
                Delete my account
              </v-btn>
            </v-card-action>
          </v-card>
        </v-dialog>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script lang="ts" src="./Settings/index.ts"></script>

<style lang="scss" scoped>
.danger-zone {
  color: red;
  border: 1px solid red;
}
</style>
