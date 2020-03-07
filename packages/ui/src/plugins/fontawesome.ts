import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faFileImport, faUsers, faCog, faUser,
  faCaretRight, faCaretDown,
} from '@fortawesome/free-solid-svg-icons'
import { faQuestionCircle, faEdit } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(
  faFileImport, faUsers, faCog, faUser,
  faCaretRight, faCaretDown,
  faQuestionCircle, faEdit,
)

Vue.component('fontawesome', FontAwesomeIcon)
