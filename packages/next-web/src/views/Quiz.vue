<template>
  <v-container class="Quiz">
    <v-dialog
      v-model="isSaveNameDialog"
      max-width="300px"
    >
      <v-card>
        <v-card-text class="pt-4 pb-0">
          <v-text-field v-model="saveName" label="Preset name" required />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text :disabled="!saveName" @click="doSaveConfirm">Save</v-btn>
          <v-btn text @click.stop="isSaveNameDialog = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="isSaveConfirmDialog"
      max-width="300px"
    >
      <v-card>
        <v-card-title>
          <span style="word-break: break-word">
            Do you want to overwrite the previous preset with the same name?
          </span>
        </v-card-title>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="doSaveUpdate">Yes</v-btn>
          <v-btn text @click.stop="isSaveConfirmDialog = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="isQuizDialog"
      @input="() => isQuizDialog ? null : doFilter()"
      max-width="800"
    >
      <v-card>
        <v-card-text class="pt-4">
          <iframe
            v-if="quizCurrent"
            frameborder="0"
            :srcdoc="iframeContent"
          ></iframe>
          <div v-else-if="quizIds.length">
            <p>Number of quizzes to go: {{ quizIds.length.toLocaleString() }}</p>
            <p>💪 Good luck!</p>
          </div>
          <div v-else>
            <p>😁 Quizzes are done!</p>
          </div>
        </v-card-text>

        <v-card-action>
          <div v-if="quizCurrent && isQuizAnswerShown" class="button-grid">
            <v-btn text color="green" @click="markQuiz('right')">
              Right
            </v-btn>
            <v-btn text color="red" @click="markQuiz('wrong')">
              Wrong
            </v-btn>
            <v-btn text color="blue" @click="markQuiz('repeat')">
              Repeat
            </v-btn>
            <v-btn text color="orange" disabled>
              Edit
            </v-btn>
            <v-btn text @click="isQuizAnswerShown = false">
              Hide answer
            </v-btn>
          </div>

          <div v-else-if="quizCurrent" class="button-grid">
            <v-btn text @click="isQuizAnswerShown = true">
              Show answer
            </v-btn>
          </div>

          <div v-else-if="quizIds.length" class="button-grid">
            <v-btn text @click="nextQuiz">
              Begin
            </v-btn>
          </div>

          <div v-else class="button-grid">
            <v-btn text @click="isQuizDialog = false">
              End quiz
            </v-btn>
          </div>
        </v-card-action>
      </v-card>
    </v-dialog>

    <v-card class="mx-4 mb-4">
      <div class="d-flex flex-row align-center mx-4 flex-wrap">
        <v-switch v-model="status.new" label="New" />
        <v-switch v-model="status.leech" label="Leech" />
        <v-switch v-model="status.graduated" label="Graduated" />
        <v-switch v-model="status.due" label="Due-only" />
        <div class="flex-grow-1"></div>
        <v-overflow-btn
          class="v-input--is-focused"
          :value="quizActions[0].text"
          :items="quizActions"
          segmented
          color="light"
          :disabled="!itemSelected.length || !quizIds.length"
        />
      </div>
    </v-card>

    <div>
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
    </div>
  </v-container>
</template>

<script lang="ts" src="./Quiz/index.ts"></script>

<style lang="scss" scoped>
.Quiz {
  ::v-deep {
    .v-treeview-node__append {
      display: flex;
      flex-direction: row;

      [data-quiz] {
        display: inline-block;
        min-width: 3em;
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
  }
}

.v-input--switch {
  margin-right: 2em;

  @media screen and (max-width: 800px) {
    width: 120px;
  }
}

.v-overflow-btn {
  flex-grow: 0;
  margin-right: 1rem;
  padding-top: 12px;

  @media screen and (max-width: 550px) {
    margin: 0 auto;
  }

  ::v-deep {
    .v-input__slot {
      width: 200px;
    }

    .v-btn__content {
      justify-content: center;
    }
  }
}

iframe {
  height: 70vh;
}

.button-grid {
  width: 100%;
  text-align: center;

  .v-btn {
    margin-bottom: 0.5rem;
  }

  .v-btn + .v-btn {
    margin-left: 0.5rem;
  }
}
</style>
