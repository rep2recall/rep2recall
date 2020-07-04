# Rep2Recall

Repeat until recall, with widening intervals.

<https://www.rep2recall.net>

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

This app uses [markdown-it](https://github.com/markdown-it/markdown-it) with
the following extensions.

- markdown-it-emoji
- markdown-it-imsize
- markdown-it-container
  - `spoiler` tags
- Custom code blocks.
  - `pug parsed` for inline Pug / HTML
  - `css parsed` for inline CSS / stylis
  - `js parsed` for inline JavaScript modules

So, Emojis are supported. Settings are roughly similar to <https://patarapolw.github.io/showdown-extra>.

## Running on your machine

Requirements are

- MongoDB
- Firebase (both on UI-side and server-side, i.e. firebase-admin)
- [Robo](https://github.com/tj/robo) for `robo.yml`-task-runner

### Required environmental variables

```sh
MONGO_URI=       # Get this from MongoDB Atlas
SECRET=          # Generate this yourself
FIREBASE_SDK=    # Get this from Firebase Admin SDK, and JSONify it
FIREBASE_CONFIG=   # Get this from Firebase Client, and JSONify it
BASE_URL=          # Where you want to deploy
```

For the development machine, you can create `.env` first, then `source .env`, or use [Oh-My-Zsh plugin dotenv](https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/dotenv).

## Offline versions

Offline versions are now available via Electron at <https://github.com/patarapolw/rep2recall/releases>.

Also, now [Anki](https://apps.ankiweb.net/)-compatible.
