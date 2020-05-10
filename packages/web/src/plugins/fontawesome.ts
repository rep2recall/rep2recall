import Vue from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faUsers, faCog, faUserSlash, faTag, faSearch, faChalkboardTeacher,
  faCaretRight, faCaretDown, faCaretUp, faList,
  faAngleDown, faAngleLeft, faAngleRight, faAngleUp, faArrowUp, faArrowDown, faExclamationCircle
} from '@fortawesome/free-solid-svg-icons'
import { faEdit } from '@fortawesome/free-regular-svg-icons'
import { faGithub, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(
  faUsers, faCog, faUserSlash, faTag, faSearch, faChalkboardTeacher,
  faCaretRight, faCaretDown, faCaretUp, faList, faExclamationCircle,
  faAngleDown, faAngleLeft, faAngleRight, faAngleUp, faArrowUp, faArrowDown,
  faEdit,
  faGithub, faGoogle
)

Vue.component('fontawesome', FontAwesomeIcon)
