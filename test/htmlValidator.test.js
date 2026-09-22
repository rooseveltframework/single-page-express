const { after, before, beforeEach, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { browsers, bundleHtmlValidate, openPage, playwright } = require('./helpers')

const timeout = 120000

// html-validate is not a dependency of the module, so it gets bundled for the browser the same way a user of single-page-express would bundle it into their own app
let htmlValidateBundle
before(async () => { htmlValidateBundle = await bundleHtmlValidate() }, { timeout })

for (const browserName of browsers) {
  describe(`html validation of post-rendered templates (${browserName})`, () => {
    let browser
    let page

    before(async () => { browser = await playwright[browserName].launch() }, { timeout })
    after(async () => await browser?.close())

    beforeEach(async () => {
      if (page) await page.close()
      page = await openPage(browser)
      page.consoleLines = []
      page.on('console', message => page.consoleLines.push({ type: message.type(), text: message.text() }))
    })

    // renders `markup` through an app built with the given options and returns the validation report the render hooks saw
    const render = (markup, options = {}) => page.evaluate(`(async () => {
      let htmlValidation
      const app = window.singlePageExpress({
        disableTopbar: true,
        defaultTarget: '#app',
        templates: { page: 'ignored, the fake engine below returns the markup' },
        templatingEngine: { render: () => ${JSON.stringify(markup)} },
        afterEveryRender: (params) => { htmlValidation = params.htmlValidation },
        ...(${options.appOptions || '{}'})
      })
      app.get('/page', (req, res) => res.render('page', {}))
      await app.triggerRoute({ route: '/page' })
      await new Promise(resolve => setTimeout(resolve, 250))
      return htmlValidation === undefined ? 'no render happened' : (htmlValidation && { valid: htmlValidation.valid, errorCount: htmlValidation.errorCount, warningCount: htmlValidation.warningCount, rules: (htmlValidation.results || []).flatMap(result => result.messages.map(message => message.ruleId)) })
    })()`)

    const loadHtmlValidate = () => page.addScriptTag({ content: htmlValidateBundle })
    const realValidator = "{ htmlValidator: new window.htmlValidate.HtmlValidate({ extends: ['html-validate:recommended'] }) }"

    describe('with a real html-validate instance', () => {
      test('reports invalid markup without preventing the render', { timeout }, async () => {
        await loadHtmlValidate()
        const report = await render('<div id="app"><p>unclosed<img src="x.png"></div>', { appOptions: realValidator })
        assert.equal(report.valid, false)
        assert.equal(report.errorCount, 2)
        assert.deepEqual(report.rules.sort(), ['no-implicit-close', 'wcag/h37'])

        // the messages name the template and where in it the problem is
        const logged = page.consoleLines.filter(line => line.text.includes('invalid html'))
        assert.equal(logged.length, 2)
        assert.equal(logged[0].type, 'error')
        assert.match(logged[0].text, /post-rendered template 'page' at line 1, column \d+/)
        assert.match(logged.map(line => line.text).join('\n'), /\[no-implicit-close\]/)

        // the render still went through
        assert.match(await page.textContent('#app'), /unclosed/)
      })

      test('says nothing about valid markup', { timeout }, async () => {
        await loadHtmlValidate()
        const report = await render('<div id="app"><p>all good</p></div>', { appOptions: realValidator })
        assert.equal(report.valid, true)
        assert.deepEqual(page.consoleLines.filter(line => line.text.includes('invalid html')), [])
      })
    })

    // a templating engine that renders through the dom, which most of them do in a browser, hands back every boolean attribute with an empty value; the style rules in `recommended` flag that, and no edit to a template can satisfy them
    describe('the config single-page-express recommends', () => {
      const domRendered = '<div id="app"><p hidden="">dash</p><script src="/x.js" defer=""></script></div>'
      const recommended = '{ htmlValidator: new window.htmlValidate.HtmlValidate(window.singlePageExpress.htmlValidateConfig) }'

      test('recommended on its own complains about markup a dom based engine produced', { timeout }, async () => {
        await loadHtmlValidate()
        const report = await render(domRendered, { appOptions: realValidator })
        assert.equal(report.valid, false)
        assert.deepEqual(report.rules.sort(), ['attribute-boolean-style', 'attribute-empty-style'])
      })

      test('the recommended config leaves that markup alone', { timeout }, async () => {
        await loadHtmlValidate()
        const report = await render(domRendered, { appOptions: recommended })
        assert.equal(report.valid, true, `expected nothing to report, got: ${JSON.stringify(report.rules)}`)
        assert.deepEqual(page.consoleLines.filter(line => line.text.includes('invalid html')), [])
      })

      // the config is a starting point, not a ceiling: an app spreads it and says whatever it wants on top, including switching one of the two back on
      test('lets an app add its own rules and override what it turns off', { timeout }, async () => {
        await loadHtmlValidate()
        const ownRules = "{ htmlValidator: new window.htmlValidate.HtmlValidate({ ...window.singlePageExpress.htmlValidateConfig, rules: { ...window.singlePageExpress.htmlValidateConfig.rules, 'attribute-boolean-style': 'error' } }) }"
        const report = await render(domRendered, { appOptions: ownRules })

        assert.equal(report.valid, false)
        assert.ok(report.rules.includes('attribute-boolean-style'), `the app asked for this one back, got: ${JSON.stringify(report.rules)}`)
        assert.ok(!report.rules.includes('attribute-empty-style'), 'the one it did not mention should still be off')
      })

      test('and still catches what is actually wrong', { timeout }, async () => {
        await loadHtmlValidate()
        const report = await render('<div id="app"><p>unclosed<img src="x.png"></div>', { appOptions: recommended })
        assert.equal(report.valid, false)
        assert.deepEqual(report.rules.sort(), ['no-implicit-close', 'wcag/h37'])
      })
    })

    describe('with any compatible validator', () => {
      test('accepts a synchronous validator', { timeout }, async () => {
        const report = await render('<div id="app">x</div>', {
          appOptions: "{ htmlValidator: { validateStringSync: () => ({ valid: false, errorCount: 1, warningCount: 0, results: [{ messages: [{ ruleId: 'made-up', severity: 2, line: 3, column: 4, message: 'something is wrong' }] }] }) } }"
        })
        assert.equal(report.valid, false)
        const logged = page.consoleLines.filter(line => line.text.includes('invalid html'))
        assert.equal(logged.length, 1)
        assert.equal(logged[0].type, 'error')
        assert.match(logged[0].text, /at line 3, column 4: something is wrong \[made-up\]/)
      })

      test('logs a warning rather than an error for warning severity', { timeout }, async () => {
        await render('<div id="app">x</div>', {
          appOptions: "{ htmlValidator: { validateStringSync: () => ({ valid: false, errorCount: 0, warningCount: 1, results: [{ messages: [{ ruleId: 'nit', severity: 1, line: 1, column: 1, message: 'minor thing' }] }] }) } }"
        })
        const logged = page.consoleLines.filter(line => line.text.includes('invalid html'))
        assert.equal(logged.length, 1)
        assert.equal(logged[0].type, 'warning')
      })

      test('accepts an asynchronous validator without delaying the render', { timeout }, async () => {
        await render('<div id="app">x</div>', {
          appOptions: "{ htmlValidator: { validateString: async () => ({ valid: false, errorCount: 1, warningCount: 0, results: [{ messages: [{ ruleId: 'async-rule', severity: 2, line: 1, column: 1, message: 'found later' }] }] }) } }"
        })
        assert.match(await page.textContent('#app'), /x/)
        const logged = page.consoleLines.filter(line => line.text.includes('invalid html'))
        assert.equal(logged.length, 1)
        assert.match(logged[0].text, /found later \[async-rule\]/)
      })

      test('complains once about a validator with no usable method, and still renders', { timeout }, async () => {
        const report = await render('<div id="app">x</div>', { appOptions: '{ htmlValidator: { nope: true } }' })
        assert.equal(report, null)
        assert.match(await page.textContent('#app'), /x/)
        const complaints = page.consoleLines.filter(line => line.text.includes('neither a `validateStringSync` nor a `validateString`'))
        assert.equal(complaints.length, 1)
      })

      test('survives a validator that throws, and still renders', { timeout }, async () => {
        const report = await render('<div id="app">x</div>', {
          appOptions: "{ htmlValidator: { validateStringSync: () => { throw new Error('validator exploded') } } }"
        })
        assert.equal(report, null)
        assert.match(await page.textContent('#app'), /x/)
        assert.equal(page.consoleLines.filter(line => line.text.includes('htmlValidator threw')).length, 1)
      })

      test('does nothing at all when no validator is supplied', { timeout }, async () => {
        const report = await render('<div id="app"><p>unclosed<img src="x.png"></div>')
        assert.equal(report, null)
        assert.deepEqual(page.consoleLines.filter(line => line.text.includes('invalid html')), [])
        assert.match(await page.textContent('#app'), /unclosed/)
      })
    })
  })
}
