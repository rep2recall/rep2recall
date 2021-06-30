import { BrowserWindow, app } from 'electron'
import puppeteer from 'puppeteer-core'
import pie from 'puppeteer-in-electron'

interface EvalContext {
  js: string
  output: unknown
}

export async function evaluate(
  scripts: EvalContext[],
  opts: {
    plugins?: string[]
    port: number
    visible?: boolean
  }
) {
  await pie.initialize(app)
  const browser = await pie.connect(app, puppeteer)

  const window = new BrowserWindow()
  await window.loadURL(`http://localhost:${opts.port}/script.html`)

  const page = await pie.getPage(browser, window)

  if (opts.plugins && opts.plugins.length) {
    await page.evaluate(/* js */ `
    s = document.createElement('script');
    s.type = "module";
    s.innerHTML = ${JSON.stringify(opts.plugins.join('\n'))};
    document.body.append(s);
    `)

    await page.waitForNavigation({
      waitUntil: 'networkidle0'
    })
  }

  await Promise.all(
    scripts.map(async (s, i) => {
      return page.evaluate(/* js */ `
        (async () => {
          return ${s};
        })().then(r => {
          __output['${i}'] = r;
          document.querySelector('#output').innerText = JSON.stringify(__output, null, 2);
          if (Object.keys(__output).length === ${scripts.length}) document.querySelector('#output').setAttribute('selected', '')
        }).catch(e => {
          const el = document.querySelector('#error');
          el.innerText += e;
          el.innerHTML += '<br/>';
          el.style.display = 'block';
        })
      `)
    })
  )

  await page.waitForSelector('#output[selected]')

  await Promise.all(
    scripts.map(async (s, i) => {
      s.output = await page.evaluate(/* js */ `__output['${i}']`)
    })
  )

  window.destroy()
}
