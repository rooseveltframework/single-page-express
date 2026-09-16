const { after, before, beforeEach, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { browsers, openPage, playwright } = require('./helpers')

const timeout = 60000

for (const browserName of browsers) {
  describe(`router api (${browserName})`, () => {
    let browser
    let page

    before(async () => { browser = await playwright[browserName].launch() }, { timeout })
    after(async () => await browser?.close())

    beforeEach(async () => {
      if (page) await page.close()
      page = await openPage(browser)
    })

    // runs a function in the page with a fresh app and a log array, and returns whatever it returns
    const run = (fn) => page.evaluate(`(async () => {
      const log = []
      const makeApp = (options) => window.singlePageExpress({ disableTopbar: true, templates: {}, templatingEngine: { render: () => '<html><body></body></html>' }, ...options })
      return await (${fn.toString()})({ log, makeApp, Router: window.singlePageExpress.Router })
    })()`)

    describe('middleware (issue 2)', () => {
      test('app.use runs middleware before the route handler', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.use((req, res, next) => { log.push('middleware'); next() })
          app.get('/page', (req, res) => { log.push('route') })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['middleware', 'route'])
      })

      test('app.use chains several middleware in registration order', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.use((req, res, next) => { log.push('one'); next() })
          app.use((req, res, next) => { log.push('two'); next() })
          app.use('/page', (req, res, next) => { log.push('three'); next() })
          app.get('/page', (req, res) => { log.push('route') })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['one', 'two', 'three', 'route'])
      })

      test('path-scoped middleware only runs for matching paths', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.use('/admin', (req, res, next) => { log.push('admin middleware'); next() })
          app.get('/admin/users', (req, res) => { log.push('admin route') })
          app.get('/public', (req, res) => { log.push('public route') })
          await app.triggerRoute({ route: '/public' })
          await app.triggerRoute({ route: '/admin/users' })
          return log
        })
        assert.deepEqual(result, ['public route', 'admin middleware', 'admin route'])
      })

      test('middleware can pass data along on the request object', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let seen
          app.use((req, res, next) => { req.user = 'ada'; next() })
          app.get('/page', (req, res) => { seen = req.user })
          await app.triggerRoute({ route: '/page' })
          return seen
        })
        assert.equal(result, 'ada')
      })

      test('route level middleware still works', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.get('/page', (req, res, next) => { log.push('route middleware'); next() }, (req, res) => { log.push('handler') })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['route middleware', 'handler'])
      })

      test('an array of handlers is accepted', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.get('/page', [(req, res, next) => { log.push('a'); next() }, (req, res, next) => { log.push('b'); next() }], (req, res) => { log.push('c') })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['a', 'b', 'c'])
      })

      test('next(err) skips ahead to error handling middleware', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.use((req, res, next) => { next(new Error('boom')) })
          app.get('/page', (req, res) => { log.push('route should not run') })
          app.use((err, req, res, next) => { log.push('error handler: ' + err.message) })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['error handler: boom'])
      })

      test('a handler that throws is routed to error handling middleware', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.get('/page', (req, res) => { throw new Error('thrown') })
          app.use((err, req, res, next) => { log.push('caught: ' + err.message) })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['caught: thrown'])
      })

      test('an async handler that rejects is routed to error handling middleware', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.get('/page', async (req, res) => { throw new Error('rejected') })
          app.use((err, req, res, next) => { log.push('caught: ' + err.message) })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['caught: rejected'])
      })

      test('async middleware is awaited before the route runs', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.use(async (req, res, next) => {
            await new Promise(resolve => setTimeout(resolve, 20))
            log.push('async middleware')
            next()
          })
          app.get('/page', (req, res) => { log.push('route') })
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['async middleware', 'route'])
      })
    })

    describe('Router (issue 3)', () => {
      test('a router mounted with app.use handles its routes', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, Router }) => {
          const app = makeApp()
          const router = Router()
          router.get('/users', (req, res) => { log.push('users') })
          app.use('/admin', router)
          await app.triggerRoute({ route: '/admin/users' })
          return log
        })
        assert.deepEqual(result, ['users'])
      })

      test('a router mounted at the root handles its routes', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, Router }) => {
          const app = makeApp()
          const router = Router()
          router.get('/page', (req, res) => { log.push('page') })
          app.use(router)
          await app.triggerRoute({ route: '/page' })
          return log
        })
        assert.deepEqual(result, ['page'])
      })

      test('router level middleware runs only for the mounted prefix', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, Router }) => {
          const app = makeApp()
          const router = Router()
          router.use((req, res, next) => { log.push('router middleware'); next() })
          router.get('/users', (req, res) => { log.push('users') })
          app.use('/admin', router)
          app.get('/public', (req, res) => { log.push('public') })
          await app.triggerRoute({ route: '/public' })
          await app.triggerRoute({ route: '/admin/users' })
          return log
        })
        assert.deepEqual(result, ['public', 'router middleware', 'users'])
      })

      test('params in the mount path are visible inside the router', { timeout }, async () => {
        const result = await run(async ({ makeApp, Router }) => {
          const app = makeApp()
          const router = Router()
          let params
          router.get('/posts/:postId', (req, res) => { params = { ...req.params } })
          app.use('/users/:userId', router)
          await app.triggerRoute({ route: '/users/7/posts/99' })
          return params
        })
        assert.deepEqual(result, { userId: '7', postId: '99' })
      })

      test('routers nest inside other routers', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, Router }) => {
          const app = makeApp()
          const inner = Router()
          inner.get('/deep', (req, res) => { log.push('deep') })
          const outer = Router()
          outer.use('/inner', inner)
          app.use('/outer', outer)
          await app.triggerRoute({ route: '/outer/inner/deep' })
          return log
        })
        assert.deepEqual(result, ['deep'])
      })

      test('router.route chains verbs for one path', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, Router }) => {
          const app = makeApp()
          const router = Router()
          router.route('/thing')
            .get((req, res) => { log.push('get') })
            .post((req, res) => { log.push('post') })
          app.use(router)
          await app.triggerRoute({ route: '/thing' })
          await app.triggerRoute({ route: '/thing', method: 'post' })
          return log
        })
        assert.deepEqual(result, ['get', 'post'])
      })

      test('req.baseUrl reports where the router was mounted', { timeout }, async () => {
        const result = await run(async ({ makeApp, Router }) => {
          const app = makeApp()
          const router = Router()
          let seen
          router.get('/users', (req, res) => { seen = { baseUrl: req.baseUrl, url: req.url, originalUrl: req.originalUrl } })
          app.use('/admin', router)
          await app.triggerRoute({ route: '/admin/users' })
          return seen
        })
        assert.deepEqual(result, { baseUrl: '/admin', url: '/users', originalUrl: '/admin/users' })
      })
    })

    describe('app mounting (issue 4)', () => {
      test('a sub-app mounted with app.use handles its routes', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          const subApp = makeApp()
          subApp.get('/page', (req, res) => { log.push('sub app page') })
          app.use('/sub', subApp)
          await app.triggerRoute({ route: '/sub/page' })
          return log
        })
        assert.deepEqual(result, ['sub app page'])
      })

      test('mountpath and path() report where the sub-app lives', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          const subApp = makeApp()
          const deepApp = makeApp()
          subApp.use('/deep', deepApp)
          app.use('/sub', subApp)
          return { rootPath: app.path(), subMountpath: subApp.mountpath, subPath: subApp.path(), deepPath: deepApp.path() }
        })
        assert.deepEqual(result, { rootPath: '', subMountpath: '/sub', subPath: '/sub', deepPath: '/sub/deep' })
      })

      test('the mount event fires with the parent app', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          const subApp = makeApp()
          let fired = false
          subApp.on('mount', (parent) => { fired = parent === app })
          app.use('/sub', subApp)
          return fired
        })
        assert.equal(result, true)
      })
    })

    describe('app.param (issue 1)', () => {
      test('a param callback receives the value and can modify the request', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          let seen
          app.param('userId', (req, res, next, value, name) => {
            log.push(`param ${name}=${value}`)
            req.user = { id: value }
            next()
          })
          app.get('/users/:userId', (req, res) => { seen = req.user })
          await app.triggerRoute({ route: '/users/42' })
          return { log, seen }
        })
        assert.deepEqual(result.log, ['param userId=42'])
        assert.deepEqual(result.seen, { id: '42' })
      })

      test('a param callback runs once per request even with several matching layers', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.param('userId', (req, res, next) => { log.push('param'); next() })
          app.get('/users/:userId', (req, res, next) => { log.push('first'); next() })
          app.get('/users/:userId', (req, res) => { log.push('second') })
          await app.triggerRoute({ route: '/users/42' })
          return log
        })
        assert.deepEqual(result, ['param', 'first', 'second'])
      })

      test('a param callback does not run when the param is absent', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.param('userId', (req, res, next) => { log.push('param'); next() })
          app.get('/other', (req, res) => { log.push('other') })
          await app.triggerRoute({ route: '/other' })
          return log
        })
        assert.deepEqual(result, ['other'])
      })

      test('next(err) from a param callback reaches error handling middleware', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.param('userId', (req, res, next) => { next(new Error('bad id')) })
          app.get('/users/:userId', (req, res) => { log.push('route should not run') })
          app.use((err, req, res, next) => { log.push('caught: ' + err.message) })
          await app.triggerRoute({ route: '/users/42' })
          return log
        })
        assert.deepEqual(result, ['caught: bad id'])
      })

      test('router.param works on a mounted router', { timeout }, async () => {
        const result = await run(async ({ log, makeApp, Router }) => {
          const app = makeApp()
          const router = Router()
          router.param('postId', (req, res, next, value) => { log.push('postId=' + value); next() })
          router.get('/posts/:postId', (req, res) => { log.push('post') })
          app.use('/blog', router)
          await app.triggerRoute({ route: '/blog/posts/5' })
          return log
        })
        assert.deepEqual(result, ['postId=5', 'post'])
      })
    })

    describe('native Node.js req and res members (issue 6)', () => {
      test('req exposes the http.IncomingMessage surface without throwing', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let seen
          app.get('/page', (req, res) => {
            seen = {
              httpVersion: req.httpVersion,
              headers: typeof req.headers,
              rawHeaders: Array.isArray(req.rawHeaders),
              complete: req.complete,
              aborted: req.aborted,
              socketIsNull: req.socket === null,
              trailers: typeof req.trailers,
              readCallable: req.read() === null,
              onReturnsReq: req.on('data', () => {}) === req,
              pipeReturnsDestination: req.pipe('dest') === 'dest',
              setTimeoutOk: req.setTimeout(1) === req,
              destroyOk: req.destroy() === req
            }
          })
          await app.triggerRoute({ route: '/page' })
          return seen
        })
        assert.deepEqual(result, {
          httpVersion: '1.1',
          headers: 'object',
          rawHeaders: true,
          complete: true,
          aborted: false,
          socketIsNull: true,
          trailers: 'object',
          readCallable: true,
          onReturnsReq: true,
          pipeReturnsDestination: true,
          setTimeoutOk: true,
          destroyOk: true
        })
      })

      test('res header methods record what they are given', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let seen
          app.get('/page', (req, res) => {
            res.setHeader('X-Test', 'one')
            res.set('X-Other', 'two')
            res.append('X-Other', 'three')
            seen = {
              getHeader: res.getHeader('x-test'),
              expressGet: res.get('X-Test'),
              appended: res.get('X-Other'),
              hasHeader: res.hasHeader('X-TEST'),
              names: res.getHeaderNames().sort(),
              all: res.getHeaders()
            }
            res.removeHeader('X-Test')
            seen.afterRemove = res.hasHeader('X-Test')
          })
          await app.triggerRoute({ route: '/page' })
          return seen
        })
        assert.equal(result.getHeader, 'one')
        assert.equal(result.expressGet, 'one')
        assert.deepEqual(result.appended, ['two', 'three'])
        assert.equal(result.hasHeader, true)
        assert.deepEqual(result.names, ['x-other', 'x-test'])
        assert.deepEqual(result.all, { 'x-test': 'one', 'x-other': ['two', 'three'] })
        assert.equal(result.afterRemove, false)
      })

      test('res status, writeHead and the write and end stubs behave sensibly', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let seen
          app.get('/page', (req, res) => {
            res.status(404)
            const afterStatus = res.statusCode
            res.writeHead(201, 'Created', { 'X-From-Write-Head': 'yes' })
            seen = {
              afterStatus,
              afterWriteHead: res.statusCode,
              statusMessage: res.statusMessage,
              headerFromWriteHead: res.getHeader('x-from-write-head'),
              writeReturned: res.write('ignored'),
              writableEndedBefore: res.writableEnded
            }
            res.end()
            seen.writableEndedAfter = res.writableEnded
          })
          await app.triggerRoute({ route: '/page' })
          return seen
        })
        assert.deepEqual(result, {
          afterStatus: 404,
          afterWriteHead: 201,
          statusMessage: 'Created',
          headerFromWriteHead: 'yes',
          writeReturned: true,
          writableEndedBefore: false,
          writableEndedAfter: true
        })
      })

      test('req.param reads from params, body and query', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let seen
          app.post('/users/:userId', (req, res) => {
            seen = { fromParams: req.param('userId'), fromBody: req.param('nickname'), missing: req.param('nope', 'fallback') }
          })
          await app.triggerRoute({ route: '/users/9', method: 'post', body: { nickname: 'ada' } })
          return seen
        })
        assert.deepEqual(result, { fromParams: '9', fromBody: 'ada', missing: 'fallback' })
      })
    })

    describe('regressions', () => {
      test('app.all still matches every method', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.all('/thing', (req, res) => { log.push(req.method) })
          await app.triggerRoute({ route: '/thing' })
          await app.triggerRoute({ route: '/thing', method: 'post' })
          await app.triggerRoute({ route: '/thing', method: 'delete' })
          return log
        })
        assert.deepEqual(result, ['get', 'post', 'delete'])
      })

      test('app.get still reads settings when called with one argument', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          app.set('custom setting', 'value')
          return { custom: app.get('custom setting'), builtIn: app.get('subdomain offset') }
        })
        assert.deepEqual(result, { custom: 'value', builtIn: 2 })
      })

      test('unmatched routes are left alone', { timeout }, async () => {
        const result = await run(async ({ log, makeApp }) => {
          const app = makeApp()
          app.use((req, res, next) => { log.push('middleware'); next() })
          app.get('/known', (req, res) => { log.push('known') })
          await app.triggerRoute({ route: '/unknown' })
          return log
        })
        assert.deepEqual(result, [], 'middleware alone must not claim a route the app does not handle')
      })

      test('parses the query string into req.query', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let seen
          app.get('/search', (req, res) => { seen = { query: { ...req.query }, originalUrl: req.originalUrl } })
          await app.triggerRoute({ route: '/search?term=hello&page=2' })
          return seen
        })
        assert.deepEqual(result.query, { term: 'hello', page: '2' })
        assert.equal(result.originalUrl, '/search?term=hello&page=2')
      })

      test('route params still work on plain app routes', { timeout }, async () => {
        const result = await run(async ({ makeApp }) => {
          const app = makeApp()
          let params
          app.get('/users/:userId/posts/:postId', (req, res) => { params = { ...req.params } })
          await app.triggerRoute({ route: '/users/1/posts/2' })
          return params
        })
        assert.deepEqual(result, { userId: '1', postId: '2' })
      })
    })

    test('no uncaught page errors were logged', { timeout }, async () => {
      assert.deepEqual(page.pageErrors, [])
    })
  })
}
