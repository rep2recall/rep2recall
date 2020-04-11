import showdown from 'showdown'
import HyperPug from 'hyperpug'
import stylis from 'stylis'
import { elementOpen, elementClose, patch } from 'incremental-dom'

import { makeIncremental } from './incremental'

export default class MakeHtml {
  md = new showdown.Converter({
    parseImgDimensions: true,
    simplifiedAutoLink: true,
    strikethrough: true,
    tables: true,
    backslashEscapesHTMLTags: true,
    emoji: true,
    literalMidWordUnderscores: true,
    smoothLivePreview: true
  })

  hp: HyperPug

  html = ''
  private el: HTMLDivElement | null = null

  constructor (
    public id = Math.random().toString(36).substr(2)
  ) {
    this.id = 'el-' + id

    this.md.addExtension({
      type: 'lang',
      regex: /\n```pug parsed\n(.+)\n```\n/gs,
      replace: (_: string, p1: string) => {
        return this.pugConvert(p1)
      }
    }, 'pug')

    this.md.addExtension({
      type: 'lang',
      regex: /\n```css parsed\n(.+)\n```\n/gs,
      replace: (_: string, p1: string) => {
        return this.makeCss(p1)
      }
    }, 'css')

    this.md.addExtension({
      type: 'lang',
      regex: /\n```js parsed\n(.+)\n```\n/gs,
      replace: (_: string, p1: string) => {
        return `<script type="module">${p1}</script>`
      }
    }, 'js')

    this.md.addExtension({
      type: 'lang',
      regex: /\n===\n/gs,
      replace: '<hr/>'
    }, 'hr')

    this.hp = new HyperPug({
      markdown: (s) => this.mdConvert(s),
      css: (s) => this.mdConvert(s)
    })
  }

  patch (dom: Element, s: string) {
    try {
      this.html = this.mdConvert(s)
    } catch (e) {}

    try {
      patch(dom, () => {
        try {
          elementOpen('div', this.id, ['class', this.id])
          makeIncremental(this.html)()
          elementClose('div')
        } catch (_) {}
      })
    } catch (_) {}
  }

  render (dom: Element, s: string) {
    const replacement = this.getDOM(s)
    dom.textContent = ''
    dom.appendChild(replacement)
  }

  getHTML (s: string) {
    return this.getDOM(s).outerHTML
  }

  private getDOM (s: string) {
    try {
      this.html = this.mdConvert(s)
    } catch (e) {}

    const output = document.createElement('div')
    output.className = this.id
    output.innerHTML = this.html

    this.el = output

    return output
  }

  private pugConvert (s: string) {
    return this.hp.parse(s)
  }

  private mdConvert (s: string) {
    return this.md.makeHtml(s)
  }

  private makeCss (s: string) {
    return `<style>${stylis(`.${this.id}`, s.replace(/\s+/gs, ' '))}</style>`
  }
}
