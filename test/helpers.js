// shared browser setup for the test suites that exercise the router API directly against the built bundle
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const playwright = require('playwright')

const bundle = path.join(__dirname, '..', 'dist', 'single-page-express.js')
const origin = 'http://single-page-express.test'

// the browsers the suites run against
const browsers = ['chromium', 'firefox']

// opens a page on a real origin with the built bundle loaded, so history, cookies and the DOM all behave normally
async function openPage (browser) {
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route(origin + '/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<html><head><title>test</title></head><body><div id="app"></div></body></html>'
  }))
  await page.goto(origin + '/')
  await page.addScriptTag({ content: fs.readFileSync(bundle, 'utf8') })
  page.pageErrors = pageErrors
  return page
}

// bundles html-validate's browser build so it can be loaded into a page, the way a user of single-page-express would bundle it into their own app; it is not a dependency of the module itself, so there is no prebuilt browser bundle of it to load
function bundleHtmlValidate () {
  const root = path.join(__dirname, '..')
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'single-page-express-html-validate-'))
  const outputFile = path.join(outputDir, 'html-validate.browser.js')
  const webpack = require('webpack')
  return new Promise((resolve, reject) => {
    webpack({
      mode: 'production',
      context: root,
      entry: 'html-validate/browser',
      output: { path: outputDir, filename: path.basename(outputFile), library: 'htmlValidate', libraryTarget: 'umd', globalObject: 'this' },
      resolve: { conditionNames: ['browser', 'require', 'default'] },
      performance: { hints: false }
    }, (error, stats) => {
      if (error) return reject(error)
      if (stats.hasErrors()) return reject(new Error('could not bundle html-validate for the browser:\n' + stats.toString({ errors: true, all: false })))
      resolve(fs.readFileSync(outputFile, 'utf8'))
    })
  })
}

// starts one of the sample apps and waits for it to report that it is listening; they all bind the same port, so only one runs at a time
function startSampleApp ({ command, args, cwd }) {
  const sampleApp = path.join(__dirname, '..', cwd)
  if (cwd !== '.' && !fs.existsSync(path.join(sampleApp, 'node_modules'))) {
    throw new Error(`the sample app in ${cwd} has dependencies of its own that are not installed; run \`npm ci\` in ${sampleApp}`)
  }
  const server = spawn(command, args, { cwd: cwd === '.' ? path.join(__dirname, '..') : sampleApp })
  const stderr = []
  server.stderr.on('data', data => stderr.push(data.toString()))
  const ready = new Promise((resolve, reject) => {
    server.on('error', reject)
    server.on('exit', code => reject(new Error(`the sample app exited early with code ${code}\n${stderr.join('')}`)))
    server.stdout.on('data', (data) => { if (data.toString().includes('server is running on')) resolve() })
  })
  return {
    ready,
    stop: () => new Promise((resolve) => {
      if (server.exitCode !== null || server.signalCode !== null) return resolve()
      server.on('exit', resolve)
      server.kill()
    })
  }
}

// leaves a marker on the window so a later check can tell a client side navigation from a full page load
const markPage = (page) => page.evaluate(() => { window.singlePageExpressTestMarker = true })

// true only if the page has not been reloaded since markPage was called, which is what proves a link was hijacked
const pageWasNotReloaded = (page) => page.evaluate(() => window.singlePageExpressTestMarker === true)

module.exports = { browsers, bundleHtmlValidate, markPage, openPage, origin, pageWasNotReloaded, playwright, startSampleApp }
