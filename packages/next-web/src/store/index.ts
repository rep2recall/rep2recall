import Vue from 'vue'
import Vuex from 'vuex'

interface Tag {
  name: string;
  q: string;
  status: {
    new: boolean;
    due: boolean;
    leech: boolean;
    graduated: boolean;
  };
  canDelete: boolean;
  itemSelected: string[];
  itemOpened: string[];
}

Vue.use(Vuex)

export default new Vuex.Store({
  state: () => ({
    tags: [{
      name: 'Default',
      q: '',
      status: {
        new: true,
        due: true,
        leech: true,
        graduated: false
      },
      canDelete: false,
      itemSelected: [''],
      itemOpened: ['']
    }] as Tag[]
  }),
  mutations: {
    ADD_TAGS (state, t: Tag) {
      if (state.tags.map((t0) => t0.name).includes(t.name)) {
        return false
      }

      state.tags = [t, ...state.tags]

      return true
    },
    REMOVE_TAGS (state, t: string) {
      if (!state.tags.map((t0) => t0.name).includes(t)) {
        return false
      }

      state.tags = state.tags.filter((t0) => t0.name !== t)

      return true
    }
  },
  actions: {
    hasTag ({ state }, t: string) {
      return state.tags.map((t0) => t0.name).includes(t)
    }
  },
  modules: {
  }
})
