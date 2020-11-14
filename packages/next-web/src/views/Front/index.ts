import 'firebase/auth'
import 'firebaseui/dist/firebaseui.css'

import firebase from 'firebase/app'
import { auth as firebaseui } from 'firebaseui'
import { Component, Vue } from 'vue-property-decorator'

@Component<Front>({
  mounted () {
    this.ui.start(this.$el.querySelector('#firebaseui') as HTMLElement, {
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.GithubAuthProvider.PROVIDER_ID,
        // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
        {
          provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
          requireDisplayName: true,
          signInMethod: firebase.auth.EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD
        }
      ],
      signInFlow: 'popup',
      callbacks: {
        signInSuccessWithAuthResult: (u) => {
          console.info(u)
          return false
        }
      }
    })
  },
  beforeDestroy () {
    this.ui.delete()
  }
})
export default class Front extends Vue {
  ui = new firebaseui.AuthUI(firebase.auth())
}
