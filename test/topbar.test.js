const { after, before, beforeEach, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { browsers, openPage, playwright } = require('./helpers')

const timeout = 120000

// a client side navigation usually has its content ready in a few milliseconds, and a progress bar for something already finished reads as a glitch rather than as progress
//
// so the bar waits: a navigation that produces its update before topbarDelay is up never shows one at all
for (const browserName of browsers) {
  describe(`the top bar (${browserName})`, () => {
    let browser
    let page

    before(async () => { browser = await playwright[browserName].launch() }, { timeout })
    after(async () => await browser?.close())
    beforeEach(async () => {
      if (page) await page.close()
      page = await openPage(browser)
    })

    // runs one navigation through an app built with the given options and reports whether the bar was ever actually on screen
    const navigate = (options = '{}', routeDelay = 0) => page.evaluate(`(async () => {
      let everVisible = false
      const watch = setInterval(() => {
        const canvas = document.querySelector('canvas[role=presentation]')
        if (canvas && !canvas.hidden) everVisible = true
      }, 15)
      const app = window.singlePageExpress({
        defaultTarget: '#app',
        templates: { page: '<div id="app">done</div>' },
        templatingEngine: { render: () => '<div id="app">done</div>' },
        alwaysSkipViewTransition: true,
        ...(${options})
      })
      app.get('/page', async (req, res) => {
        if (${routeDelay}) await new Promise(resolve => setTimeout(resolve, ${routeDelay}))
        res.render('page', {})
      })
      await app.triggerRoute({ route: '/page' })
      await new Promise(resolve => setTimeout(resolve, 600))
      clearInterval(watch)
      return everVisible
    })()`)

    test('stays away when the navigation is faster than the delay', { timeout }, async () => {
      assert.equal(await navigate('{ topbarDelay: 250 }'), false, 'a navigation that finished immediately should not have shown a progress bar')
    })

    test('appears when the navigation takes longer than the delay', { timeout }, async () => {
      assert.equal(await navigate('{ topbarDelay: 50 }', 250), true, 'a navigation slower than the delay should show a progress bar')
    })

    // with no delay the bar goes up as soon as the navigation starts, rather than waiting to see whether it will be quick; it still comes down as soon as there is markup, so the route is given a little work to do
    test('appears immediately when the delay is set to zero', { timeout }, async () => {
      assert.equal(await navigate('{ topbarDelay: 0 }', 120), true, 'topbarDelay 0 should show the bar the moment a navigation starts')
    })

    // a view transition paints its capture of the page rather than the live document, so a bar still on screen when one starts freezes and then vanishes when the live page returns
    //
    // nothing can paint through a transition, so the bar has to be finished before the page changes, which is the ordering this pins
    test('finishes before the content changes, not during the transition that follows', { timeout }, async () => {
      const result = await page.evaluate(`(async () => {
        const app = window.singlePageExpress({
          defaultTarget: '#app',
          templates: { page: '<div id="app">done</div>' },
          templatingEngine: { render: () => '<div id="app">done</div>' },
          alwaysSkipViewTransition: true,
          topbarDelay: 0
        })
        const start = performance.now()
        let everShown = false
        let barGoneAt = null
        let contentAt = null
        const seen = setInterval(() => {
          const canvas = document.querySelector('canvas[role=presentation]')
          if (canvas && !canvas.hidden) everShown = true
        }, 5)

        // both moments come from the same observer, so their order is exact rather than however often a poll happened to look
        new MutationObserver(records => {
          for (const record of records) {
            const isBarHiding = record.type === 'attributes' && record.target.nodeName === 'CANVAS'
            if (isBarHiding) {
              if (barGoneAt === null && record.target.hidden) barGoneAt = performance.now() - start
              continue
            }
            const touchesCanvas = [...record.addedNodes, ...record.removedNodes, record.target].some(node => node && node.nodeName === 'CANVAS')
            if (!touchesCanvas && contentAt === null) contentAt = performance.now() - start
          }
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] })

        app.get('/page', async (req, res) => {
          await new Promise(resolve => setTimeout(resolve, 150)) // long enough that the bar is up
          res.render('page', {})
        })
        await app.triggerRoute({ route: '/page' })
        await new Promise(resolve => setTimeout(resolve, 1200))
        clearInterval(seen)
        return { everShown, barGoneAt, contentAt }
      })()`)

      assert.equal(result.everShown, true, 'the bar should have been up while the route was working')
      assert.notEqual(result.barGoneAt, null, 'and it should have come down')
      assert.notEqual(result.contentAt, null, 'and the content should have changed')
      assert.ok(result.barGoneAt <= result.contentAt, `the bar has to be gone before the content changes, or a transition captures it mid animation; bar gone at ${result.barGoneAt}ms, content at ${result.contentAt}ms`)
    })

    test('stays away when it is disabled, however slow the navigation is', { timeout }, async () => {
      assert.equal(await navigate('{ disableTopbar: true, topbarDelay: 0 }', 200), false, 'disableTopbar should still win')
    })
  })
}
