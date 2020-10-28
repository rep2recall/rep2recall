<template>
  <v-container class="Quiz">
    <v-btn block color="accent"
      :disabled="!itemSelected.length"
      @click="startQuiz"
    >Start Quiz</v-btn>
    <v-treeview
      v-model="itemSelected"
      :items="treeview"
      :open.sync="itemOpened"
      selectable
      dense
    >
      <template v-slot:append="{ item, open }">
        <div v-if="!item.children || !open">
          <div data-quiz="new">
            {{ item.new.toLocaleString() }}
          </div>
          <div data-quiz="due">
            {{ item.due.toLocaleString() }}
          </div>
          <div data-quiz="leech">
            {{ item.leech.toLocaleString() }}
          </div>
        </div>
      </template>
    </v-treeview>
  </v-container>
</template>

<script lang="ts" src="./Quiz/index.ts"></script>

<style lang="scss" scoped>
.Quiz ::v-deep .v-treeview-node__append {
  display: flex;
  flex-direction: row;

  [data-quiz] {
    display: inline-block;
    width: 3em;
    text-align: right;
    margin-left: 0.5em;
  }

  [data-quiz="new"] {
    color: green;
  }

  [data-quiz="due"] {
    color: blue;
  }

  [data-quiz="leech"] {
    color: red;
  }
}
</style>
