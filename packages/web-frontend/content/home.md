# Rep2Recall

Repeat until recall, with widening intervals. :muscle:

```pug parsed
center
  :markdown
    ![Gfycat screenshot](https://thumbs.gfycat.com/ChillyHospitableBison-size_restricted.gif)
```

<button class="button is-info" style="width: 100%; margin-top: 1em; margin-bottom: 1em;" v-on:click="ctx.doLogin">
  Login
</button>

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

You can try it out <nuxt-link to="/playground">here</nuxt-link>.
