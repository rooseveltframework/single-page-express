const { after, before, beforeEach, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { browsers, markPage, pageWasNotReloaded, playwright, startSampleApp } = require('./helpers')

const baseURL = 'http://localhost:3000'
const timeout = 60000

// the sample apps all bind the same port, so each one is started, tested against every browser, then stopped before the next begins
const sampleApps = [
  { title: 'basic frontend-only sample app', command: process.execPath, args: ['scripts/serve-sample-app.js', 'basicFrontendOnly'], cwd: '.' },
  { title: 'basic frontend-only sample app with templating', command: process.execPath, args: ['scripts/serve-sample-app.js', 'basicFrontendOnlyWithTemplating'], cwd: '.' },
  { title: 'express-complex sample app', command: process.execPath, args: ['server.js'], cwd: 'sampleApps/express-complex' }
]

// a stand-in for the external site the sample apps link to, so that the tests never reach the network
const externalSite = 'https://github.com/rooseveltframework/single-page-express'
const stubExternalSite = (page) => page.route('https://github.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body><h1>external site</h1></body></html>' }))

for (const sampleApp of sampleApps) {
  describe(sampleApp.title, () => {
    let server
    before(async () => {
      server = startSampleApp(sampleApp)
      await server.ready
    }, { timeout })
    after(async () => await server?.stop())

    for (const browserName of browsers) {
      describe(browserName, () => {
        let browser
        let page

        before(async () => { browser = await playwright[browserName].launch() }, { timeout })
        after(async () => await browser?.close())

        beforeEach(async () => {
          if (page) await page.close()
          page = await browser.newPage({ baseURL })
          // the browser console is only echoed when asked for: these tests deliberately drive paths that log, such as a render with no templating engine, and forwarding all of it buries the test results it is interleaved with
          //
          // run with SPE_TEST_CONSOLE=1 to see it when debugging a failure
          if (process.env.SPE_TEST_CONSOLE) page.on('console', message => console.log(message.text()))
        })

        // navigates by clicking a link and reports whether the router handled it client side
        const clickLink = async (href, waitFor) => {
          await page.goto('/')
          await markPage(page)
          await page.click(`a[href="${href}"]`)
          if (waitFor) await waitFor()
          return pageWasNotReloaded(page)
        }

        if (sampleApp.cwd === '.' && sampleApp.args[1] === 'basicFrontendOnly') {
          // this sample app is served by a static file server, so any navigation the router fails to hijack lands on a 404 rather than a page
          test('hijacks links to registered routes', { timeout }, async () => {
            for (const href of ['/testlink2', '/test/foo/bar', '/wildcard/something']) {
              assert.equal(await clickLink(href), true, `${href} was not handled client side`)
              assert.equal(new URL(page.url()).pathname, href, `the url was not updated for ${href}`)
            }
          })

          test('keeps the query string on the url', { timeout }, async () => {
            assert.equal(await clickLink('/testlink2?with=query&params=too'), true)
            assert.equal(page.url(), `${baseURL}/testlink2?with=query&params=too`)
          })

          test('leaves external links to the browser', { timeout }, async () => {
            await stubExternalSite(page)
            await page.goto('/')
            await markPage(page)
            await page.click(`a[href="${externalSite}"]`)
            await page.waitForURL(externalSite)
            assert.equal(await pageWasNotReloaded(page), false, 'an external link must not be handled client side')
            assert.equal(await page.textContent('h1'), 'external site')
          })

          test('hijacks a form submit to a registered route', { timeout }, async () => {
            const routeFired = new Promise(resolve => page.on('console', message => { if (message.text().startsWith('req.body:')) resolve() }))
            await page.goto('/')
            await markPage(page)
            await page.fill('form[action="/testform"] input[name="sometext"]', 'hello')
            await page.click('form[action="/testform"] button[type="submit"]')
            await routeFired
            assert.equal(await pageWasNotReloaded(page), true, 'the form submit was not handled client side')
            assert.equal(new URL(page.url()).pathname, '/', 'a post should not add a history entry')
          })

          test('leaves a form with an external action to the browser', { timeout }, async () => {
            await stubExternalSite(page)
            await page.goto('/')
            await markPage(page)
            await page.click(`form[action="${externalSite}"] button[type="submit"]`)
            await page.waitForURL(/github\.com/)
            assert.equal(await pageWasNotReloaded(page), false, 'a form posting to another site must not be handled client side')
          })
        }

        if (sampleApp.args[1] === 'basicFrontendOnlyWithTemplating') {
          test('renders the second page client side', { timeout }, async () => {
            const handled = await clickLink('/secondPage', () => page.waitForFunction(() => document.body.textContent.includes('hi there!')))
            assert.equal(handled, true)
            assert.match(await page.textContent('article'), /this is a second page and prints a variable with contents: "hi there!"/)
          })

          test('restores the homepage with the back button, still client side', { timeout }, async () => {
            await clickLink('/secondPage', () => page.waitForFunction(() => document.body.textContent.includes('hi there!')))
            await page.goBack()
            await page.waitForFunction(() => /hello world/.test(document.body.textContent))
            assert.equal(await pageWasNotReloaded(page), true, 'the back button caused a full page load')
          })
        }

        if (sampleApp.cwd === 'sampleApps/express-complex') {
          test('should render the homepage correctly', { timeout }, async () => {
            await page.goto('/')
            assert.equal(await page.textContent('#homepage p'), 'hello world')
          })

          test('should render the second page correctly', { timeout }, async () => {
            const handled = await clickLink('/secondPage', () => page.waitForSelector('#secondPage p'))
            assert.equal(handled, true, 'the navigation was served by the express server rather than the router')
            assert.equal(await page.textContent('#secondPage p'), 'this is a second page and prints a variable with contents: "hi there!"')
          })

          test('should render route params', { timeout }, async () => {
            const handled = await clickLink('/route/with/params', () => page.waitForSelector('#pageWithParams'))
            assert.equal(handled, true)
            assert.equal(await page.textContent('#pageWithParams p:nth-of-type(1)'), 'withParam: with')
            assert.equal(await page.textContent('#pageWithParams p:nth-of-type(2)'), 'anotherParam: params')
          })

          test('should submit a form and render req.body back', { timeout }, async () => {
            await clickLink('/pageWithForm', () => page.waitForSelector('#pageWithForm form'))
            await page.fill('#first_name', 'Ada')
            await page.click('button[name="button1"]')
            await page.waitForSelector('#pageWithForm p')
            assert.equal(await pageWasNotReloaded(page), true, 'the form submit was served by the express server rather than the router')
            assert.equal(await page.textContent('#pageWithForm p'), 'You said your first name is: Ada')
          })

          test('should honor a route that overrides the render target', { timeout }, async () => {
            const handled = await clickLink('/routeUsingTarget', () => page.waitForFunction(() => document.body.textContent.includes('partial template without layout')))
            assert.equal(handled, true)
            assert.match(await page.textContent('body > article'), /partial template without layout/)
          })

          test('should update the page title from res.title', { timeout }, async () => {
            const handled = await clickLink('/pageWithTitleOverride', () => page.waitForFunction(() => document.title === 'Different Page Title'))
            assert.equal(handled, true)
            assert.equal(await page.title(), 'Different Page Title')
          })

          test('should render a route that awaits data before rendering', { timeout }, async () => {
            const handled = await clickLink('/pageWithDataRetrieval', () => page.waitForFunction(() => /\d/.test(document.querySelector('body > article')?.textContent || '')))
            assert.equal(handled, true)
            assert.match(await page.textContent('body > article'), /\d/)
          })

          test('should add head tags a template brings with it', { timeout }, async () => {
            const before = await page.evaluate(() => document.head.querySelectorAll('link[href*="extra"], script[src*="extra"]').length)
            await clickLink('/additionalHeadTags', () => page.waitForFunction(() => document.head.querySelectorAll('link[href*="extra"], script[src*="extra"]').length > 0))
            const added = await page.evaluate(() => document.head.querySelectorAll('link[href*="extra"], script[src*="extra"]').length)
            assert.equal(before, 0)
            assert.ok(added > 0, 'the extra head tags from the template were not added to the page')
          })

          test('should hijack every link in the sample app nav', { timeout }, async () => {
            await page.goto('/')
            const hrefs = await page.$$eval('nav a[href^="/"]', links => links.map(link => link.getAttribute('href')))
            assert.ok(hrefs.length >= 8, `expected the sample app nav to have several links, found ${hrefs.length}`)
            for (const href of hrefs) {
              await page.goto('/')
              await markPage(page)
              await page.click(`nav a[href="${href}"]`)
              await page.waitForFunction(path => window.location.pathname === path, href)
              assert.equal(await pageWasNotReloaded(page), true, `${href} was not handled client side`)
            }
          })

          describe('animation', () => {
            test('wraps the dom update in a view transition', { timeout }, async () => {
              await page.goto('/')
              await page.waitForSelector('#homepage')
              // count the calls single-page-express makes, rather than assume the api is used
              await page.evaluate(() => {
                window.viewTransitionCount = 0
                const original = document.startViewTransition.bind(document)
                document.startViewTransition = (callback) => { window.viewTransitionCount++; return original(callback) }
              })
              await page.click('a[href="/secondPage"]')
              await page.waitForSelector('#secondPage p')
              assert.equal(await page.evaluate(() => window.viewTransitionCount), 1, 'the dom update was not wrapped in a view transition')
            })

            test('runs the sample app render hooks, which drive its animations', { timeout }, async () => {
              await page.goto('/')
              await page.waitForSelector('#homepage')
              // the sample app's beforeEveryRender adds this class when the next page is the same page, and removes it otherwise
              await page.click('a[href="/"]')
              await page.waitForFunction(() => document.documentElement.classList.contains('fade'))
              assert.ok(await page.evaluate(() => document.documentElement.classList.contains('fade')), 'beforeEveryRender did not run')
            })

            test('marks the html element when the back and forward buttons are used', { timeout }, async () => {
              await page.goto('/')
              await page.click('a[href="/secondPage"]')
              await page.waitForSelector('#secondPage p')
              assert.equal(await page.evaluate(() => document.documentElement.className.includes('ButtonPressed')), false, 'a normal navigation must not be marked as a back or forward navigation')

              await page.goBack()
              await page.waitForSelector('#homepage p')
              assert.ok(await page.evaluate(() => document.documentElement.classList.contains('backButtonPressed')), 'the back button did not mark the html element')

              await page.goForward()
              await page.waitForSelector('#secondPage p')
              assert.ok(await page.evaluate(() => document.documentElement.classList.contains('forwardButtonPressed')), 'the forward button did not mark the html element')
            })
          })

          test('should restore the previous page with the back button', { timeout }, async () => {
            await page.goto('/')
            await markPage(page)
            await page.click('a[href="/secondPage"]')
            await page.waitForSelector('#secondPage p')
            await page.goBack()
            await page.waitForSelector('#homepage p')
            assert.equal(await page.textContent('#homepage p'), 'hello world')
            assert.equal(await pageWasNotReloaded(page), true, 'the back button caused a full page load')
          })

          test('should restore the scroll position of a page when returning to it', { timeout }, async () => {
            await page.goto('/verbosePage')
            await page.waitForSelector('body > article')
            await page.evaluate(() => window.scrollTo(0, 400))
            await page.waitForFunction(() => window.scrollY > 300)
            await markPage(page)
            await page.click('a[href="/secondPage"]')
            await page.waitForSelector('#secondPage p')
            await page.goBack()
            await page.waitForFunction(() => window.scrollY > 300, null, { timeout: 10000 })
            assert.equal(await pageWasNotReloaded(page), true)
            assert.ok(await page.evaluate(() => window.scrollY) > 300, 'the scroll position was not restored')
          })
        }
      })
    }
  })
}
