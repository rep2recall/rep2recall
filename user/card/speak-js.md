```js parsed
window.addEventListener('keydown', (ev) => {
  if (ev.key === 's') {
    const s = window.getSelection().toString()
    if (s) {
      speak(s)
    }
  }
})

window.speak = (s, lang = 'zh-CN', rate = 1) => {
  const u = new SpeechSynthesisUtterance(s)
  u.lang = lang
  u.rate = rate
  speechSynthesis.speak(u)
}
```
