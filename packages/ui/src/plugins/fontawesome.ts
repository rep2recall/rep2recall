import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faUsers, faCog, faUserSlash, faTag,
  faCaretRight, faCaretDown, faCaretUp, faList,
} from '@fortawesome/free-solid-svg-icons'
import { faQuestionCircle, faEdit } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(
  faUsers, faCog, faUserSlash, faTag,
  faCaretRight, faCaretDown, faCaretUp, faList,
  faQuestionCircle, faEdit,
)

Vue.component('fontawesome', FontAwesomeIcon)
