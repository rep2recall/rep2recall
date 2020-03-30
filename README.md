# Rep2Recall

Repeat until recall. Is this possible?

![Screen GIF](http://recordit.co/Z36oOSy8fU)

This is a remake of <https://github.com/patarapolw/rep2recall-web>.

As for offline version, you might try <https://github.com/patarapolw/rep2recall-app>.

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

## Plans

- Expose the API, probably via OAuth2 or API keys, so that the deck can programmatically generated.
- Offline support.
