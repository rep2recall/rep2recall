import imsize from '@patarapolw/markdown-it-imsize'
import HyperPug from 'hyperpug'
import { elementClose, elementOpen, patch } from 'incremental-dom'
import MarkdownIt from 'markdown-it'
import mdContainer from 'markdown-it-container'
import emoji from 'markdown-it-emoji'
import extLink from 'markdown-it-external-links'
import { unescapeAll } from 'markdown-it/lib/common/utils'
import stylis from 'stylis'

import { makeIncremental } from './incremental'

export default class MakeHtml {
  md: MarkdownIt
  hp: HyperPug

  html = ''
  private el: HTMLDivElement | null = null

  constructor(public id = Math.random().toString(36).substr(2)) {
    this.id = 'el-' + id
    this.md = MarkdownIt({
      // breaks: true,
      html: true,
    })
      .use((md) => {
        const { fence } = md.renderer.rules

        md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
          const token = tokens[idx]
          const info = token.info ? unescapeAll(token.info).trim() : ''
          const content = token.content

          if (info === 'pug parsed') {
            return this.pugConvert(content)
          } else if (info === 'css parsed') {
            return this.makeCss(content)
          } else if (info === 'js parsed') {
            return `<script type="module">${content}</script>`
          }

          return fence!(tokens, idx, options, env, slf)
        }
        return md
      })
      .use(extLink, {
        externalTarget: '_blank',
        externalRel: 'noopener nofollow',
      })
      .use(emoji)
      .use(imsize)
      .use(mdContainer, 'spoiler', {
        validate: (params: string) => {
          return params.trim().match(/^spoiler(?:\s+(.*))?$/)
        },
        render: (tokens: any[], idx: number) => {
          const m = tokens[idx].info.trim().match(/^spoiler(?:\s+(.*))?$/)

          if (tokens[idx].nesting === 1) {
            // opening tag
            return (
              '<details style="margin-bottom: 1rem;"><summary>' +
              this.md.utils.escapeHtml(m[1] || 'Spoiler') +
              '</summary>\n'
            )
          } else {
            // closing tag
            return '</details>\n'
          }
        },
      })

    // this.md.addExtension(
    //   {
    //     type: 'lang',
    //     regex: /\n===\n/gs,
    //     replace: '<hr/>'
    //   },
    //   'hr'
    // )

    this.hp = new HyperPug({
      markdown: (s) => this.mdConvert(s),
      css: (s) => this.mdConvert(s),
    })
  }

  patch(dom: Element, s: string) {
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

  render(dom: Element, s: string) {
    const replacement = this.getDOM(s)
    dom.textContent = ''
    dom.appendChild(replacement)
  }

  getHTML(s: string) {
    try {
      this.html = this.mdConvert(s)
    } catch (e) {}

    return `<div class="${this.id}">${this.html}</div>`
  }

  private getDOM(s: string) {
    try {
      this.html = this.mdConvert(s)
    } catch (e) {}

    const output = document.createElement('div')
    output.className = this.id
    output.innerHTML = this.html

    this.el = output

    return output
  }

  private pugConvert(s: string) {
    return this.hp.parse(s)
  }

  private mdConvert(s: string) {
    return this.md.render(s)
  }

  private makeCss(s: string) {
    return `<style>${stylis(`.${this.id}`, s.replace(/\s+/gs, ' '))}</style>`
  }
}
