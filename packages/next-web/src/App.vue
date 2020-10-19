<template>
  <v-app>
    <v-app-bar app color="primary" dark hide-on-scroll>
      <v-app-bar-nav-icon @click.stop="isDrawer = !isDrawer" />
      <v-spacer />
      <form @submit.prevent="doSearch">
        <v-text-field
          label="Search"
          v-model="q"
          hide-details="auto"
          append-icon="mdi-magnify"
          @click:append="doSearch"
        />
      </form>
    </v-app-bar>

    <v-navigation-drawer
      v-model="isDrawer"
      absolute
      temporary
      style="height: 100vh;"
    >
      <v-list>
        <v-list-group
          class="group-quiz"
          :value="isTagOpen"
          prepend-icon="mdi-comment-question-outline"
        >
          <template v-slot:activator>
            <v-list-item-title @click.stop="$router.push('/')">
              Quiz
            </v-list-item-title>
          </template>

          <v-list-item
            v-for="(t, i) in tags"
            :key="i"
            link
            dense
          >
            <v-list-item-content>
              <v-list-item-title> {{t}} </v-list-item-title>
            </v-list-item-content>

            <v-list-item-action>
              <v-btn icon @click="doDelete(t)">
                <v-icon>mdi-trash-can-outline</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list-group>

        <v-list-item to="/edit">
          <v-list-item-icon>
            <v-icon>mdi-pencil</v-icon>
          </v-list-item-icon>

          <v-list-item-content>
            <v-list-item-title>Edit</v-list-item-title>
          </v-list-item-content>
        </v-list-item>

        <v-list-item to="/settings">
          <v-list-item-icon>
            <v-icon>mdi-cog</v-icon>
          </v-list-item-icon>

          <v-list-item-content>
            <v-list-item-title>Settings</v-list-item-title>
          </v-list-item-content>
        </v-list-item>

        <v-list-item
          href="https://www.github.com/patarapolw/rep2recall"
          target="_blank"
          rel="noopener noreferrer"
        >
          <v-list-item-icon>
            <v-icon>mdi-github</v-icon>
          </v-list-item-icon>

          <v-list-item-content>
            <v-list-item-title>About</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>

      <template v-slot:append>
        <v-list-item two-line>
          <v-list-item-avatar>
            <img src="https://randomuser.me/api/portraits/lego/1.jpg">
          </v-list-item-avatar>

          <v-list-item-content>
            <v-list-item-title>John Doe</v-list-item-title>
            <v-list-item-subtitle>
              <v-btn x-small color="primary">
                Logout
              </v-btn>
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </template>
    </v-navigation-drawer>

    <v-main>
      <router-view/>
    </v-main>
  </v-app>
</template>

<script lang="ts" src="./app/index.ts"></script>

<style lang="scss" scoped>
.v-list-item, .v-list-group:not(.v-list-group--active) {
  &:hover {
    background-color: rgba(173, 216, 230, 0.2);
  }
}

.group-quiz ::v-deep .v-list-group__items {
  background-color: rgba(177, 197, 195, 0.2);

  .v-list-item {
    padding-left: 3em;
  }

  .v-btn {
    filter: opacity(0.5);

    &:hover {
      filter: unset;
    }
  }
}
</style>