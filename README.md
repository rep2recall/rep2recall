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

Also, now [Anki](https://apps.ankiweb.net/)-compatible.

## Running on your machine (offline-enabled)

`docker-compose` or `podman-compose` is required.

```sh
git clone https://github.com/rep2recall/rep2recall.git
cd rep2recall
docker-compose build

# mkdir mongo-data -- This might be required for podman-compose
docker-compose up
# docker-compose down
```
