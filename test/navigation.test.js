// what a navigation does from start to finish: awaiting it, one superseding another, its errors, where it's recorded in the history, which links it captures, and what it does to focus and scrolling
const { after, before, beforeEach, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { browsers, openPage, playwright } = require('./helpers')

const timeout = 60000
const bundle = path.join(__dirname, '..', 'dist', 'single-page-express.js')

for (const browserName of browsers) {
  describe(`navigation (${browserName})`, () => {
    let browser
    let page

    before(async () => { browser = await playwright[browserName].launch() }, { timeout })
    after(async () => await browser?.close())

    beforeEach(async () => {
      if (page) await page.close()
      page = await openPage(browser)
    })

    // runs a function in the page with a fresh app whose templates write the model's text into #app, and returns whatever it returns
    const run = (fn, target = page) => target.evaluate(`(async () => {
      const log = []
      const makeApp = (options) => window.singlePageExpress({
        disableTopbar: true,
        alwaysSkipViewTransition: true,
        defaultTarget: '#app',
        templates: { page: 'page' },
        templatingEngine: { render: (template, model) => '<html><body><div id="app">' + (model.text || '') + '</div></body></html>' },
        ...options
      })
      const shown = () => document.getElementById('app').textContent
      const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
      return await (${fn.toString()})({ log, makeApp, shown, wait })
    })()`)

    describe('awaiting a navigation', () => {
      test('app.triggerRoute resolves once the page is rendered and the render callback has finished', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, shown, wait }) => {
          const app = makeApp({ updateDelay: 50 })
          app.get('/page', (req, res) => res.render('page', { text: 'rendered' }, async () => { await wait(50); log.push('callback done') }))
          await app.triggerRoute({ route: '/page' })
          return [shown(), ...log]
        })
        assert.deepEqual(result, ['rendered', 'callback done'])
      })

      test('a custom render method is awaited when it returns a promise', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, wait }) => {
          const app = makeApp({ renderMethod: async (template, model) => { await wait(50); log.push(`rendered ${model.text}`) } })
          app.get('/page', (req, res) => res.render('page', { text: 'custom' }))
          await app.triggerRoute({ route: '/page' })
          log.push('resolved')
          return log
        })
        assert.deepEqual(result, ['rendered custom', 'resolved'])
      })
    })

    describe('one navigation superseding another', () => {
      test('a navigation started while an earlier one is still working wins, and the earlier one is told', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, shown, wait }) => {
          const app = makeApp()
          app.get('/slow', async (req, res) => {
            await wait(150)
            log.push(`slow aborted: ${req.signal.aborted}`)
            res.render('page', { text: 'slow' })
          })
          app.get('/fast', (req, res) => res.render('page', { text: 'fast' }))
          const slow = app.triggerRoute({ route: '/slow' })
          await app.triggerRoute({ route: '/fast' })
          await slow
          return [shown(), ...log]
        })
        assert.deepEqual(result, ['fast', 'slow aborted: true'])
      })

      test('a form posted to a route that renders nothing does not stop a page from rendering', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, shown, wait }) => {
          const app = makeApp({ updateDelay: 50 })
          app.get('/page', (req, res) => res.render('page', { text: 'page' }))
          app.post('/save', (req, res) => { log.push('saved') })
          const page = app.triggerRoute({ route: '/page' })
          await app.triggerRoute({ route: '/save', method: 'post' })
          await page
          return [shown(), ...log]
        })
        assert.deepEqual(result, ['page', 'saved'])
      })
    })

    describe('errors', () => {
      test('app.triggerRoute rejects with an error nothing handled, and with one thrown by a render callback', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          app.get('/broken', () => { throw new Error('route broke') })
          app.get('/callback', (req, res) => res.render('page', { text: 'x' }, () => { throw new Error('callback broke') }))
          const caught = []
          await app.triggerRoute({ route: '/broken' }).catch(error => caught.push(error.message))
          await app.triggerRoute({ route: '/callback' }).catch(error => caught.push(error.message))
          return caught
        })
        assert.deepEqual(result, ['route broke', 'callback broke'])
      })

      test('app.triggerRoute warns about a route nothing handles', { timeout }, async () => {
        const warnings = []
        page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()) })
        await run(async ({ makeApp }) => {
          const app = makeApp()
          await app.triggerRoute({ route: '/nowhere' })
        })
        assert.ok(warnings.some(warning => warning.includes('/nowhere') && warning.includes('no route handles')), warnings.join('\n'))
      })
    })

    describe('history', () => {
      test('a navigation is pushed, replaced, or left out of the browser history as asked', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          app.get('/:name', (req, res) => res.render('page', { text: req.params.name }))
          const start = window.history.length
          await app.triggerRoute({ route: '/one' })
          await app.triggerRoute({ route: '/two', history: 'replace' })
          await app.triggerRoute({ route: '/three', history: 'none' })
          return [window.history.length - start, window.location.pathname]
        })
        assert.deepEqual(result, [1, '/two'])
      })

      test('going back asks for the page again with its query string and its body', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.get('/search', (req, res) => { log.push(`search ${req.query.q}`); res.render('page', { text: 'search' }) })
          app.get('/playlist', (req, res) => { log.push(`playlist ${req.body?.name}`); res.render('page', { text: 'playlist' }) })
          await app.triggerRoute({ route: '/search?q=beatles' })
          await app.triggerRoute({ route: '/playlist', body: { name: 'Mix' } })
          await app.triggerRoute({ route: '/search?q=bowie' })
          await app.back()
          await app.back()
          return log
        })
        assert.deepEqual(result, ['search beatles', 'playlist Mix', 'search bowie', 'playlist Mix', 'search beatles'])
      })

      test('a memory history moves back and forward without changing the url', { timeout }, async () => {
        const result = await run(async ({ makeApp, shown }) => {
          const app = makeApp({ history: 'memory' })
          app.get('/:name', (req, res) => res.render('page', { text: req.params.name }))
          const url = window.location.href
          const length = window.history.length
          await app.triggerRoute({ route: '/one' })
          await app.triggerRoute({ route: '/two' })
          const seen = []
          seen.push(await app.back(), shown(), app.canGoBack(), app.canGoForward())
          seen.push(await app.forward(), shown())
          seen.push(await app.forward()) // (nothing ahead)
          await app.triggerRoute({ route: '/three', history: 'replace' })
          await app.back()
          seen.push(shown(), window.location.href === url && window.history.length === length)
          return seen
        })
        assert.deepEqual(result, [true, 'one', false, true, true, 'two', false, 'one', true])
      })

      test('a page loaded from a file can keep a memory history, leaving the url alone', { timeout }, async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'single-page-express-file-'))
        const file = path.join(dir, 'page.html')
        fs.writeFileSync(file, '<html><head><title>test</title></head><body><div id="app"></div></body></html>')
        const filePage = await browser.newPage()
        try {
          await filePage.goto('file://' + file)
          await filePage.addScriptTag({ content: fs.readFileSync(bundle, 'utf8') })
          const result = await run(async ({ makeApp, shown }) => {
            const app = makeApp({ history: 'memory' })
            app.get('/one', (req, res) => res.render('page', { text: 'one' }))
            app.get('/two', (req, res) => res.render('page', { text: 'two' }))
            const url = window.location.href
            await app.triggerRoute({ route: '/one' })
            await app.triggerRoute({ route: '/two' })
            await app.back()
            return [app.historyMode, shown(), window.location.href === url]
          }, filePage)
          assert.deepEqual(result, ['memory', 'one', true])
        } finally {
          await filePage.close()
          fs.rmSync(dir, { recursive: true, force: true })
        }
      })

      test('a browser that refuses to record a navigation leaves the app with a memory history', { timeout }, async () => {
        const result = await run(async ({ makeApp, shown }) => {
          const app = makeApp()
          app.get('/:name', (req, res) => res.render('page', { text: req.params.name }))
          window.history.pushState = () => { throw new DOMException('refused', 'SecurityError') }
          await app.triggerRoute({ route: '/one' })
          await app.triggerRoute({ route: '/two' })
          await app.back()
          return [app.historyMode, shown()]
        })
        assert.deepEqual(result, ['memory', 'one'])
      })
    })

    describe('links', () => {
      test('a click anywhere inside a link follows it, but not one the browser gives its own meaning to', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, wait }) => {
          const app = makeApp()
          app.get('/target', (req, res) => { log.push('followed') })
          document.getElementById('app').innerHTML = '<a id="plain" href="/target"><span id="inner">inside</span></a><a id="blank" href="/target" target="_blank">new window</a><a id="download" href="/target" download>download</a><a id="other" href="https://example.com/target">elsewhere</a>'
          const prevent = (event) => event.preventDefault() // (so a link not followed doesn't navigate the test page away)
          document.addEventListener('click', prevent)
          document.getElementById('inner').click()
          await wait(50)
          log.push('---')
          for (const id of ['blank', 'download', 'other']) document.getElementById(id).click()
          document.getElementById('plain').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
          await wait(50)
          document.removeEventListener('click', prevent)
          return log
        })
        assert.deepEqual(result, ['followed', '---'])
      })
    })

    describe('focus, announcements, and scrolling', () => {
      test('focus and announcements can be turned off for the app, or for one render', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const focusedAfter = async (options, route) => {
            document.getElementById('app').innerHTML = ''
            const button = document.body.appendChild(document.createElement('button'))
            button.focus()
            const app = makeApp(options)
            app.get('/page', (req, res) => res.render('page', { text: 'page' }))
            app.get('/quiet', (req, res) => { res.focus = false; res.announce = false; res.render('page', { text: 'quiet' }) })
            await app.triggerRoute({ route })
            const kept = document.activeElement === button
            const announced = document.getElementById('singlePageExpressDefaultRenderMethodAriaLiveRegion')?.textContent || ''
            button.remove()
            document.getElementById('singlePageExpressDefaultRenderMethodAriaLiveRegion')?.remove()
            return `${kept ? 'kept focus' : 'moved focus'}, ${announced ? 'announced' : 'quiet'}`
          }
          return [
            await focusedAfter({}, '/page'),
            await focusedAfter({ manageFocus: false, announcePageChange: false }, '/page'),
            await focusedAfter({}, '/quiet')
          ]
        })
        assert.deepEqual(result, ['moved focus, announced', 'kept focus, quiet', 'kept focus, quiet'])
      })

      test('with scroll restoration off, the page is left where it is', { timeout }, async () => {
        const result = await run(async ({ makeApp, wait }) => {
          document.body.style.height = '5000px'
          const app = makeApp({ scrollRestoration: false })
          app.get('/:name', (req, res) => res.render('page', { text: req.params.name }))
          window.scrollTo(0, 1000)
          await app.triggerRoute({ route: '/one' })
          await wait(50)
          return window.scrollY
        })
        assert.equal(result, 1000)
      })

      test('a query string with a ? in a value is read whole', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let query
          app.get('/search', (req) => { query = req.query })
          await app.triggerRoute({ route: '/search?q=what?&page=2' })
          return query
        })
        assert.deepEqual(result, { q: 'what?', page: '2' })
      })
    })
  })
}
