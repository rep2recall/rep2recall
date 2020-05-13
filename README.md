# Rep2Recall

Repeat until recall, with widening intervals.

[![Gfycat screenshot](https://thumbs.gfycat.com/ChillyHospitableBison-size_restricted.gif)](https://gfycat.com/chillyhospitablebison)

This is a remake of <https://github.com/patarapolw/rep2recall-web>.

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

## Running on your machine

Requirements are

- MongoDB
- Firebase (both on UI-side and server-side)

### Required environmental variables

```sh
# Run time variables
MONGO_URI=       # Get this from MongoDB Atlas
SECRET=          # Generate this yourself
FIREBASE_SDK=    # Get this from Firebase Admin SDK, and JSONify it

# Build time variables
VUE_APP_FIREBASE_CONFIG=   # Get this from Firebase Client, and JSONify it
VUE_APP_BASE_URL=          # Where you want to deploy
```

For the development machine, you can create `.env` first, then `source .`, or use [Oh-My-Zsh plugin dotenv](https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/dotenv).

## Offline versions

Offline versions are now available via Electron at <https://github.com/patarapolw/rep2recall/releases>.

Also, now [Anki](https://apps.ankiweb.net/)-compatible.
