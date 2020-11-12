<template>
  <v-container class="Browse">
    <v-row class="nav">
      <v-spacer></v-spacer>
      <v-btn color="white">
        New
      </v-btn>
      <v-overflow-btn
        class="v-input--is-focused"
        :value="batchActions[0].text"
        :items="batchActions"
        segmented
        color="light"
        :disabled="!itemSelected.length"
      />
    </v-row>

    <v-data-table
      class="elevation-1"
      v-model="itemSelected"
      :headers="columns"
      :items="noteData"
      :loading="isLoading"
      :options.sync="dataOptions"
      :server-items-length="count"
      show-select
    >
      <!-- eslint-disable-next-line vue/valid-v-slot -->
      <template v-slot:item.action="{ item }">
        <v-icon
          small
          class="mr-2"
          @click="doEdit(item)"
        >
          mdi-pencil
        </v-icon>
        <v-icon
          small
          @click="doDelete(item)"
        >
          mdi-delete
        </v-icon>
      </template>
    </v-data-table>
  </v-container>
</template>

<script lang="ts" src="./Browse/index.ts"></script>

<style lang="scss" scoped>
.Browse {
  .nav {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    .v-btn {
      width: 120px;
      height: 50px;
    }

    .v-overflow-btn {
      flex-grow: 0;
      margin-left: 30px;
      padding-top: 12px;

      ::v-deep {
        .v-input__slot {
          width: 150px;
        }

        .v-btn__content {
          justify-content: center;
        }
      }
    }

    @media screen and (max-width: 600px) {
      .spacer {
        display: none;
      }
    }
  }
}
</style>
