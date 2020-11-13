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
      width="270"
    >
      <v-list>
        <v-list-group
          class="group-quiz"
          :value="isTagOpen"
          prepend-icon="mdi-frequently-asked-questions"
        >
          <template v-slot:activator>
            <v-list-item-title @click.stop="$router.push('/')">
              Quiz
            </v-list-item-title>
          </template>

          <v-list-item
            v-for="t in $store.state.tags"
            :key="t.id"
            link
            dense
          >
            <v-list-item-content @click="doLoad(t.id)">
              <v-list-item-title> {{t.name}} </v-list-item-title>
            </v-list-item-content>

            <v-list-item-action v-if="t.canDelete">
              <v-btn icon @click="doDelete(t.id)">
                <v-icon>mdi-trash-can-outline</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list-group>

        <v-list-item to="/browse">
          <v-list-item-icon>
            <v-icon>mdi-format-list-bulleted</v-icon>
          </v-list-item-icon>

          <v-list-item-content>
            <v-list-item-title>Browse</v-list-item-title>
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
            <img :src="user.image">
          </v-list-item-avatar>

          <v-list-item-content>
            <v-list-item-title>
              {{ user.name }}
            </v-list-item-title>
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
.v-text-field {
  width: 400px;

  @media screen and (max-width: 500px) {
    width: calc(100vw - 60px);
  }
}

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
