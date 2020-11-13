<template>
  <!-- eslint-disable vue/valid-v-slot -->
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
      :items="tableData"
      :loading="isLoading"
      :options.sync="dataOptions"
      :server-items-length="count"
      :hide-default-footer="!tableData.length"
      show-select
    >
      <template v-slot:item.front="{ item }">
        <iframe
          v-if="$vuetify.breakpoint.mdAndUp"
          :srcdoc="getData(item.key, 'front') || ''"
          frameborder="0"
        ></iframe>
        <div v-else class="scroll"> {{ item.front }} </div>
      </template>

      <template v-slot:item.back="{ item }">
        <iframe
          v-if="$vuetify.breakpoint.mdAndUp"
          :srcdoc="getData(item.key, 'back') || ''"
          frameborder="0"
        ></iframe>
        <div v-else class="scroll"> {{ item.back }} </div>
      </template>

      <template v-slot:item.attr="{ item }">
        <div v-if="getData(item.key, 'attr')" class="scroll">
          <pre
            v-if="$vuetify.breakpoint.mdAndUp"
          >
            <code class="yaml language-yaml">
              {{ yamlDump(getData(item.key, 'attr')) }}
            </code>
          </pre>
          <span v-else> {{ JSON.stringify(getData(item.key, 'attr')) }} </span>
        </div>
      </template>

      <template v-slot:item.action="{ item }">
        <v-icon
          small
          class="mr-2"
          @click="doEdit(item.key)"
        >
          mdi-pencil
        </v-icon>
        <v-icon
          small
          @click="doDelete(item.key)"
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
