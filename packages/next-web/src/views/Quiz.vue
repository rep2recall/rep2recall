<template>
  <v-container class="home">
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
    />
  </v-container>
</template>

<script lang="ts" src="./Quiz/index.ts"></script>
