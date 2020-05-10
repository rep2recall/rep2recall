<template lang="pug">
.columns
  .column.is-8-desktop.is-offset-2-desktop(style="margin-top: 1em;")
    .content
      :markdown
        # Rep2Recall

        Repeat until recall, with widening intervals. :muscle:

        ^^pug.
          center
            span ![Gfycat screenshot](https://thumbs.gfycat.com/ChillyHospitableBison-size_restricted.gif)

      b-button.is-info(style="width: 100%; marign-top: 1em; margin-bottom: 1em;" @click="doLogin()")
        fontawesome(:icon="['fab', 'google']" style="margin-right: 1em;")
        span Login with Google

      :markdown
        ## Features

        - [Handlebars](https://handlebarsjs.com/) support across markdown files
          - Data dictionary support, via YAML frontmatter
        - Full range of CSS and JS support
          - SCSS-like syntax is supported, via [stylis](https://github.com/thysultan/stylis.js)
        - Extended markdown support. See below.
        - Powerful searchbar. See <https://github.com/patarapolw/qsearch>.

        ## Note on Markdown

        This app uses [showdownjs](https://github.com/showdownjs/showdown) with the following extensions. (See [packages/ui/src/make-html/index.ts](/packages/ui/src/make-html/index.ts).)

        ```js
        {
          parseImgDimensions: true,
          simplifiedAutoLink: true,
          strikethrough: true,
          tables: true,
          backslashEscapesHTMLTags: true,
          emoji: true,
          literalMidWordUnderscores: true,
          smoothLivePreview: true,
          metadata: true,
        }
        ```

        So, Emojis are supported. Settings are roughly similar to <https://patarapolw.github.io/showdown-extra>.
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import firebase from 'firebase/app'

import 'firebase/auth'

@Component
export default class Home extends Vue {
  doLogin () {
    const provider = new firebase.auth.GoogleAuthProvider()
    firebase.auth().signInWithPopup(provider)
  }
}
</script>
