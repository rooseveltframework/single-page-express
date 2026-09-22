const pathToRegexpMatch = require('path-to-regexp').match // route parser for express 5+
const pathToRegexpMatchExpress4 = require('path-to-regexp-express4') // route parser for express 4; express 3 and below are not supported
const parser = new window.DOMParser() // used by the default render method

// the visually hidden live region the default render method uses to announce page changes to screen readers
const ariaLiveRegionId = 'singlePageExpressDefaultRenderMethodAriaLiveRegion'
const ariaLiveRegionStyles = {
  position: 'absolute',
  top: '-9999px',
  left: '-9999px',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  border: '0',
  margin: '-1px',
  padding: '0',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap'
}

// #region routing engine

// taken from https://expressjs.com/en/5x/api.html#routing-methods
const httpVerbs = [
  'checkout',
  'copy',
  'delete',
  'get',
  'head',
  'lock',
  'merge',
  'mkactivity',
  'mkcol',
  'move',
  'm-search',
  'notify',
  'options',
  'patch',
  'post',
  'purge',
  'put',
  'report',
  'search',
  'subscribe',
  'trace',
  'unlock',
  'unsubscribe'
]

const matcherCache = new Map() // compiled matchers, keyed by the pattern plus the settings it was compiled with

// compiles a route pattern into a function that tests a path, returning the portion of it that matched plus any params captured, or false
function compileMatcher (path, { sensitive, strict, end, expressVersion }) {
  const cacheKey = `${expressVersion}|${sensitive ? 1 : 0}|${strict ? 1 : 0}|${end ? 1 : 0}|${path}`
  const cached = matcherCache.get(cacheKey)
  if (cached) return cached

  let matcher
  if (!end && (path === '/' || path === '')) {
    matcher = () => ({ path: '', params: {} }) // middleware mounted at the root matches every path; the express 5 parser does not treat `/` as a prefix on its own
  } else if (expressVersion === 5) {
    try {
      const match = pathToRegexpMatch(path, { sensitive, end, trailing: !strict }) // the newer version of path-to-regexp returns a matching function
      matcher = (pathname) => match(pathname)
    } catch (error) {
      console.error(`single-page-express: failed to register the route '${path}' because it could not be parsed.`)
      if (path.includes('*')) console.error('single-page-express: routes with \'*\' in them should be written like \'*all\' instead in Express 5+ syntax.')
      console.error(error)
      matcher = () => false
    }
  } else {
    // the older version of path-to-regexp returns a regular expression along with the names of the params it found
    const keys = []
    const regexp = pathToRegexpMatchExpress4(path, keys, { sensitive, strict, end })
    matcher = (pathname) => {
      const result = regexp.exec(pathname)
      if (!result) return false
      const params = {}
      for (const [index, key] of keys.entries()) {
        if (result[index + 1] !== undefined) params[key.name] = result[index + 1]
      }
      return { path: result[0], params }
    }
  }

  matcherCache.set(cacheKey, matcher)
  return matcher
}

// true if the handler is a router or an app rather than a plain middleware function
function isRouterLike (handle) {
  return !!handle && (handle.singlePageExpressRouter === true || handle.singlePageExpressApp === true)
}

// flattens the handler arguments accepted by app.use and the routing methods, which allow arrays and any number of arguments
function flattenHandlers (args) {
  return args.flat(Infinity).filter(handler => typeof handler === 'function' || isRouterLike(handler))
}

// creates a router: an ordered stack of middleware and route layers that a request gets walked through; see https://expressjs.com/en/5x/api.html#router
function createRouter (routerOptions = {}) {
  const router = {}
  router.singlePageExpressRouter = true
  router.stack = [] // the layers, in the order they were registered
  router.paramCallbacks = {} // callbacks registered with router.param(), keyed by param name
  router.routerOptions = routerOptions

  // registers one or more handlers for a path and method; a method of null matches every method, as app.all does
  function addRoute (method, path, args) {
    const handlers = flattenHandlers(args)
    if (!handlers.length) {
      console.error(`single-page-express: no handler function was supplied for the route '${path}'.`)
      return
    }
    for (const handle of handlers) router.stack.push({ kind: 'route', method, path, handle })
  }

  router.use = (...args) => {
    const path = typeof args[0] === 'string' ? args.shift() : '/'
    const handlers = flattenHandlers(args)
    if (!handlers.length) {
      console.error(`single-page-express: no middleware function was supplied to use('${path}').`)
      return router
    }
    for (const handle of handlers) {
      router.stack.push({
        kind: 'middleware',
        path,
        handle,
        // express identifies error handling middleware by its arity; see https://expressjs.com/en/guide/error-handling.html
        isErrorHandler: typeof handle === 'function' && handle.length === 4
      })
    }
    return router
  }

  router.all = (path, ...handlers) => { addRoute(null, path, handlers); return router }
  for (const verb of httpVerbs) {
    router[verb] = (path, ...handlers) => { addRoute(verb, path, handlers); return router }
  }

  router.route = (path) => {
    const route = { path }
    route.all = (...handlers) => { addRoute(null, path, handlers); return route }
    for (const verb of httpVerbs) {
      route[verb] = (...handlers) => { addRoute(verb, path, handlers); return route }
    }
    return route
  }

  // see https://expressjs.com/en/5x/api.html#app.param
  router.param = (name, callback) => {
    if (typeof callback !== 'function') {
      console.error(`single-page-express: the callback supplied to param('${name}') is not a function.`)
      return router
    }
    if (!router.paramCallbacks[name]) router.paramCallbacks[name] = []
    router.paramCallbacks[name].push(callback)
    return router
  }

  return router
}

// true if any route in this router, or in any router or app mounted under it, would handle this method and path
function routerHandlesRequest (router, pathname, method, settings) {
  const routerSettings = routerSettingsFor(router, settings)
  for (const layer of router.stack) {
    if (layer.kind === 'route') {
      if (layer.method !== null && layer.method !== method) continue
      if (compileMatcher(layer.path, { ...routerSettings, end: true })(pathname)) return true
    } else if (isRouterLike(layer.handle)) {
      const match = compileMatcher(layer.path, { ...routerSettings, end: false })(pathname)
      if (!match) continue
      if (routerHandlesRequest(layer.handle.router || layer.handle, remainingPath(pathname, match.path), method, settings)) return true
    }
  }
  return false
}

// a router may override the app's case sensitivity and strict routing settings, as express routers can
function routerSettingsFor (router, settings) {
  return {
    expressVersion: settings.expressVersion,
    sensitive: router.routerOptions?.caseSensitive ?? settings.sensitive,
    strict: router.routerOptions?.strict ?? settings.strict
  }
}

// what is left of a path after a mount point has consumed its prefix
function remainingPath (pathname, consumed) {
  const rest = pathname.slice(consumed.length)
  if (!rest) return '/'
  return rest.startsWith('/') ? rest : '/' + rest
}

// invokes one handler and resolves with what the router should do next; express advances the stack only when next() is called, so a handler that returns without calling it has handled the request
function invokeHandler (handle, req, res, error) {
  return new Promise((resolve) => {
    let advanced = false
    const next = (nextError) => {
      if (advanced) return
      advanced = true
      resolve({ advance: true, error: nextError === 'route' || nextError === 'router' ? null : nextError, skip: nextError })
    }
    let result
    try {
      result = error ? handle(error, req, res, next) : handle(req, res, next)
    } catch (thrown) {
      if (!advanced) {
        advanced = true
        resolve({ advance: true, error: thrown })
      }
      return
    }
    if (result && typeof result.then === 'function') {
      result.then(
        () => { if (!advanced) { advanced = true; resolve({ advance: false }) } },
        (thrown) => { if (!advanced) { advanced = true; resolve({ advance: true, error: thrown }) } }
      )
    } else if (!advanced) {
      advanced = true
      resolve({ advance: false })
    }
  })
}

// walks a router's stack for a request; resolves with the error still in flight, if any, once the stack is exhausted or a handler has handled the request
async function dispatchRouter (router, req, res, settings, state) {
  const routerSettings = routerSettingsFor(router, settings)
  const layers = router.stack
  let error = state.error

  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index]
    const isRoute = layer.kind === 'route'

    // while an error is in flight only error handling middleware runs; the rest of the time it is skipped
    if (error && (isRoute || !layer.isErrorHandler)) continue
    if (!error && layer.isErrorHandler) continue

    if (isRoute && layer.method !== null && layer.method !== req.method) continue

    const match = compileMatcher(layer.path, { ...routerSettings, end: isRoute })(state.pathname)
    if (!match) continue

    // params captured by a mount path stay visible to everything mounted beneath it, as express does
    const params = { ...state.params, ...match.params }

    if (isRouterLike(layer.handle)) {
      const mounted = layer.handle.router || layer.handle
      const consumed = match.path
      const previousBaseUrl = req.baseUrl
      const previousUrl = req.url
      req.baseUrl = state.baseUrl + consumed
      req.url = remainingPath(state.pathname, consumed)
      error = await dispatchRouter(mounted, req, res, settings, {
        pathname: req.url,
        baseUrl: req.baseUrl,
        params,
        error,
        handled: state.handled
      })
      req.baseUrl = previousBaseUrl
      req.url = previousUrl
      if (state.handled.done) return error
      continue
    }

    req.params = params
    req.baseUrl = state.baseUrl
    if (isRoute) {
      req.route = { path: layer.path, methods: layer.method === null ? { _all: true } : { [layer.method]: true } }
      const paramError = await runParamCallbacks(router, req, res, settings)
      if (paramError) { error = paramError; continue }
    }

    const outcome = await invokeHandler(layer.handle, req, res, error)
    if (!outcome.advance) { // the handler did not call next(), so it has handled the request
      state.handled.done = true
      return null
    }
    error = outcome.error || null
    if (outcome.skip === 'router') return error // next('router') leaves this router entirely
  }

  return error
}

// runs the callbacks registered with router.param() for whichever params this request captured, once per request per param
async function runParamCallbacks (router, req, res, settings) {
  const callbacks = router.paramCallbacks
  if (!callbacks || !req.params) return null
  for (const name of Object.keys(req.params)) {
    const registered = callbacks[name]
    if (!registered) continue
    if (req.singlePageExpressCalledParams.has(router)) {
      if (req.singlePageExpressCalledParams.get(router).has(name)) continue
    } else req.singlePageExpressCalledParams.set(router, new Set())
    req.singlePageExpressCalledParams.get(router).add(name)
    for (const callback of registered) {
      const value = req.params[name]
      const outcome = await new Promise((resolve) => {
        let advanced = false
        const next = (nextError) => { if (!advanced) { advanced = true; resolve({ error: nextError }) } }
        let result
        try {
          result = callback(req, res, next, value, name)
        } catch (thrown) {
          if (!advanced) { advanced = true; resolve({ error: thrown }) }
          return
        }
        if (result && typeof result.then === 'function') {
          result.then(
            () => { if (!advanced) { advanced = true; resolve({ error: null }) } },
            (thrown) => { if (!advanced) { advanced = true; resolve({ error: thrown }) } }
          )
        } else if (!advanced) { advanced = true; resolve({ error: null }) }
      })
      if (outcome.error) return outcome.error
    }
  }
  return null
}

// #endregion

function singlePageExpress (options) {
  // #region constructor params and top-level variable declarations
  const app = {} // instance of the router app
  app.expressVersion = options.expressVersion // which version of the express api to target
  if (app.expressVersion !== 5 && (parseInt(app.expressVersion) <= 4)) app.expressVersion = 4 // permit express 4 and 5+
  if (!app.expressVersion) app.expressVersion = 5 // default to express 5
  app.appVars = {} // for app.set() / app.get()
  app.templatingEngine = options.templatingEngine // which templating engine to use
  app.templates = options.templates // templates to render
  app.htmlValidator = options.htmlValidator // optional html validator to check post-rendered templates with, e.g. an html-validate instance
  if (!app.templates) console.warn('single-page-express: no templates are loaded; as such the default render method will just print the template name and model to the console.')
  app.router = createRouter() // the root router: every route and piece of middleware registered on the app lands in its stack
  app.mounted = [] // apps and routers mounted on this app, for app.path() and the mount event
  app.defaultTarget = options.defaultTarget // which element to replace by default
  app.defaultTargets = app.defaultTarget ? [app.defaultTarget].concat(options.defaultTargets || []) : options.defaultTargets || [] // which elements to replace by default
  if (!app.defaultTargets.length) app.defaultTargets = ['body'] // body tag is the default target if none is set
  app.beforeEveryRender = options.beforeEveryRender // function to execute before every DOM update if using the default render method
  app.updateDelay = options.updateDelay // how long to delay after executing app.beforeEveryRender or this.beforeRender before performing the DOM update
  app.afterEveryRender = options.afterEveryRender // function to execute after every DOM update if using the default render method
  app.postRenderCallbacks = options.postRenderCallbacks || {} // list of callback functions to execute after a render event occurs
  app.topbarEnabled = !options.disableTopbar // whether to use topbar https://buunguyen.github.io/topbar/
  app.topBarRoutes = options.topBarRoutes // which routes to use the topbar on; defaults to all if this option is not supplied
  app.topbarDelay = options.topbarDelay ?? 250 // how long a navigation has to be still working before the top bar appears at all; set it to 0 to show the bar the moment a navigation starts
  if (app.topbarEnabled || app.topBarRoutes) {
    app.topbar = require('topbar')
    app.topbar.config(options.topbarConfig || {
      // default options
      barColors: {
        0: 'rgba(0,  0, 0, .7)',
        '1.0': 'rgba(0, 0,  0,  .7)'
      }
    })
  }
  app.alwaysSkipViewTransition = options.alwaysSkipViewTransition // never wrap dom updates in document.startViewTransition() calls
  app.alwaysScrollTop = options.alwaysScrollTop // always scroll to the top of the page after every render
  app.urls = {} // list of URLs that have been visited and metadata about them
  let currentRoute = window.location.pathname // the route currently on screen; the back and forward buttons update window.location before popstate fires, so this is what says which page is being left
  let currentViewTransition // a global reference to the current view transition so we can know when it has ended

  // a client side navigation usually has its content ready in a few milliseconds, and a progress bar that appears for something already finished reads as a glitch rather than as progress: it crawls along on its own timer, then jumps to the end the moment it is told to hide
  //
  // so the bar is scheduled rather than shown, and a navigation that produces its update before the delay is up cancels it and never shows anything at all
  let topbarTimer = null
  let topbarShowing = false
  const topbarFadeDuration = 120 // long enough to read as a fade, short enough that holding the page back for it does not matter

  function topbarWantedFor (route) {
    return (app.topbarEnabled && !app.topBarRoutes) || app.topBarRoutes?.includes?.(route)
  }

  function scheduleTopbar (route) {
    if (!topbarWantedFor(route)) return
    window.clearTimeout(topbarTimer)
    topbarTimer = window.setTimeout(() => {
      topbarTimer = null
      topbarShowing = true
      app.topbar.show()
    }, parseInt(app.topbarDelay) || 0)
  }

  // the navigation has something to show, so a bar that has not appeared yet is no longer needed, and one that has is finished reporting
  //
  // this is also the last moment it can be taken off screen: a view transition paints its capture of the page rather than the live document, so a bar still showing when one starts freezes for the length of the animation and then disappears when the live page comes back, which reads as a flash
  //
  // nothing can keep painting through a transition, not a z-index and not the top layer, so the only fix is to be gone before it starts
  function contentReady () {
    window.clearTimeout(topbarTimer)
    topbarTimer = null
    if (!topbarShowing) return Promise.resolve()
    topbarShowing = false

    const canvas = document.querySelector('canvas[role=presentation]')
    if (!canvas) {
      app.topbar.hide()
      return Promise.resolve()
    }

    // the bar fades out where it stands rather than running out to the right hand edge first
    //
    // it has to be gone before the page changes, because a view transition paints its capture of the page rather than the live document, and a bar still on screen when one starts freezes where it is and then vanishes when the live page comes back
    //
    // that makes every millisecond it spends finishing a millisecond the reader waits for content that is already there, so this is kept short: letting topbar play its own hide out in full costs several hundred
    canvas.style.transition = `opacity ${topbarFadeDuration}ms`
    canvas.style.opacity = 0

    return new Promise(resolve => window.setTimeout(() => {
      canvas.hidden = true
      canvas.style.transition = '' // so the next navigation's bar appears at once instead of fading in
      app.topbar.hide() // resets topbar's own state for the next navigation, on a canvas that is already off screen
      resolve()
    }, topbarFadeDuration))
  }

  let pageSettledCallback
  function claimPageSettledCallback () {
    const callback = pageSettledCallback
    pageSettledCallback = null
    return () => { if (typeof callback === 'function') callback() }
  }

  // #endregion

  // #region express app

  // express app object settings
  app.appVars['case sensitive routing'] = false
  app.appVars.env = 'production'
  app.appVars['query parser'] = true
  app.appVars['strict routing'] = false
  app.appVars['subdomain offset'] = 2
  // the other settings are not supported

  // express app object properties
  app.singlePageExpressApp = true
  app.locals = {}
  app.mountpath = '' // set when this app is mounted on another app with app.use()
  app.parent = null // the app this one is mounted on, if any

  // express app object events; apps are event emitters in express, but only the mount event is meaningful here
  const eventListeners = {}
  app.on = (event, listener) => {
    if (typeof listener !== 'function') return app
    if (!eventListeners[event]) eventListeners[event] = []
    eventListeners[event].push(listener)
    return app
  }
  app.once = (event, listener) => {
    const wrapper = (...args) => {
      app.off(event, wrapper)
      listener(...args)
    }
    return app.on(event, wrapper)
  }
  app.off = (event, listener) => {
    if (eventListeners[event]) eventListeners[event] = eventListeners[event].filter(registered => registered !== listener)
    return app
  }
  app.removeListener = app.off
  app.emit = (event, ...args) => {
    if (!eventListeners[event]?.length) return false
    for (const listener of [...eventListeners[event]]) listener(...args)
    return true
  }

  // express app object methods
  app.all = (route, ...handlers) => { app.router.all(route, ...handlers); return app }
  app.disable = (name) => { app.appVars[name] = false; return app }
  app.disabled = (name) => { return !app.appVars[name] }
  app.enable = (name) => { app.appVars[name] = true; return app }
  app.enabled = (name) => { return !!app.appVars[name] }
  app.engine = () => app // stubbed out
  app.listen = () => {} // stubbed out
  httpVerbs.forEach(method => { // app.METHOD
    app[method] = (route, ...handlers) => { app.router[method](route, ...handlers); return app }
  })
  app.get = (route, ...handlers) => { // in the express docs, this method is overloaded and can be used for more than one thing based on the number of arguments
    if (!handlers.length) return app.appVars[route] // app.get('setting name') reads a setting
    app.router.get(route, ...handlers)
    return app
  }
  app.param = (name, callback) => { app.router.param(name, callback); return app }
  app.path = () => (app.parent ? app.parent.path() : '') + app.mountpath // see https://expressjs.com/en/5x/api.html#app.path
  // app.render will be defined below
  app.route = (route) => app.router.route(route)
  app.set = (name, val) => { app.appVars[name] = val; return app }
  app.use = (...args) => {
    const path = typeof args[0] === 'string' ? args[0] : '/'
    app.router.use(...args)
    // mounting an app on another app makes it a sub-app, which gets told where it was mounted
    for (const handle of flattenHandlers(typeof args[0] === 'string' ? args.slice(1) : args)) {
      if (handle?.singlePageExpressApp) {
        handle.mountpath = path
        handle.parent = app
        app.mounted.push(handle)
        handle.emit('mount', app)
      }
    }
    return app
  }
  app.triggerRoute = handleRoute // single-page-express-exclusive method

  // #endregion

  // #region request object

  const defaultReq = {} // this is later extended during a "request" cycle

  // request object properties
  defaultReq.app = app
  defaultReq.baseUrl = '' // set at runtime to the path a router or sub-app was mounted at
  // req.body is defined at runtime below
  // req.cookies is defined at runtime below
  defaultReq.fresh = true // stubbed out
  defaultReq.hostname = window.location.hostname
  defaultReq.ip = '127.0.0.1' // stubbed out
  defaultReq.ips = [] // stubbed out
  // req.method is defined at runtime below
  // req.originalUrl is defined at runtime below
  // req.params is defined at runtime below
  // req.path is defined at runtime below
  // req.protocol is defined at runtime below
  // req.query is defined at runtime below
  // req.res is defined below because res is not initialized yet
  // req.route is defined at runtime below
  // req.secure is defined at runtime below
  defaultReq.signedCookies = {} // stubbed out
  defaultReq.stale = false // stubbed out
  // req.subdomains is defined at runtime below
  defaultReq.xhr = true // stubbed out

  // request object methods
  defaultReq.accepts = () => {} // stubbed out
  defaultReq.acceptsCharsets = () => {} // stubbed out
  defaultReq.acceptsEncodings = () => {} // stubbed out
  defaultReq.acceptsLanguages = () => {} // stubbed out
  defaultReq.get = () => {} // stubbed out
  defaultReq.is = () => {} // stubbed out
  defaultReq.param = function (name, defaultValue) { // deprecated in express, but it is still there, so it is still here
    if (this.params?.[name] !== undefined) return this.params[name]
    if (this.body?.[name] !== undefined) return this.body[name]
    if (this.query?.[name] !== undefined) return this.query[name]
    return defaultValue
  }
  defaultReq.range = () => {} // stubbed out

  // properties and methods from the native Node.js http.IncomingMessage API that express's request object inherits from; they are stubbed out so that a route written against them does not crash when it is reused on the frontend; see https://nodejs.org/api/http.html#class-httpincomingmessage
  defaultReq.aborted = false
  defaultReq.complete = true
  defaultReq.connection = null
  defaultReq.headers = {}
  defaultReq.headersDistinct = {}
  defaultReq.httpVersion = '1.1'
  defaultReq.httpVersionMajor = 1
  defaultReq.httpVersionMinor = 1
  defaultReq.rawHeaders = []
  defaultReq.rawTrailers = []
  defaultReq.socket = null
  defaultReq.statusCode = null
  defaultReq.statusMessage = null
  defaultReq.trailers = {}
  defaultReq.trailersDistinct = {}
  // req.url is defined at runtime below
  defaultReq.destroy = function () { return this }
  defaultReq.setTimeout = function () { return this }

  // the readable stream methods http.IncomingMessage inherits; there is no request body stream in the browser, so they do nothing; see https://nodejs.org/api/stream.html#class-streamreadable
  defaultReq.destroyed = false
  defaultReq.readable = false
  defaultReq.readableEnded = true
  defaultReq.isPaused = () => false
  defaultReq.pause = function () { return this }
  defaultReq.pipe = (destination) => destination
  defaultReq.read = () => null
  defaultReq.resume = function () { return this }
  defaultReq.setEncoding = function () { return this }
  defaultReq.unpipe = function () { return this }
  defaultReq.unshift = () => {}
  defaultReq.wrap = function () { return this }
  defaultReq.addListener = function () { return this }
  defaultReq.emit = () => false
  defaultReq.off = function () { return this }
  defaultReq.on = function () { return this }
  defaultReq.once = function () { return this }
  defaultReq.removeAllListeners = function () { return this }
  defaultReq.removeListener = function () { return this }

  // new properties
  defaultReq.singlePageExpress = true

  // #endregion

  // #region response object

  const res = {}

  // response object properties
  res.app = app
  res.headersSent = false // nothing is ever sent over the wire, so headers are never sent
  res.locals = {}

  // headers have no meaning in the browser, but they are recorded so that a route that sets one and reads it back behaves consistently
  const headers = new Map() // keyed by lowercased header name, holding the name as written and its value
  const headerKey = (name) => ('' + name).toLowerCase()
  // res.req defined at runtime below

  // response object methods
  res.append = (name, value) => {
    const existing = headers.get(headerKey(name))?.value
    if (existing === undefined) return res.set(name, value)
    return res.set(name, [].concat(existing).concat(value))
  }
  res.attachment = () => { return res } // stubbed out
  res.cookie = (name, value, options = {}) => {
    const {
      domain,
      encode = encodeURIComponent,
      expires,
      httpOnly,
      maxAge,
      path = '/',
      partitioned,
      priority,
      secure,
      signed,
      sameSite
    } = options
    let cookieString = `${encode(name)}=${encode(value)}`
    if (expires instanceof Date) cookieString += `; expires=${expires.toUTCString()}`
    if (maxAge) cookieString += `; max-age=${maxAge}`
    if (domain) cookieString += `; domain=${domain}`
    if (path) cookieString += `; path=${path}`
    if (secure) cookieString += '; secure'
    if (httpOnly) cookieString += '; HttpOnly'
    if (sameSite) cookieString += `; SameSite=${sameSite}`
    if (partitioned) cookieString += '; Partitioned'
    if (priority) cookieString += `; Priority=${priority}`
    if (signed) {
      if (app.appVars.env === 'development') console.warn('Signed cookies are not supported in the browser context.')
    }
    document.cookie = cookieString
  }
  res.clearCookie = (name, options = {}) => {
    const {
      domain,
      encode = encodeURIComponent,
      httpOnly,
      path = '/',
      partitioned,
      priority,
      secure,
      signed,
      sameSite
    } = options
    const pastDate = new Date(0).toUTCString() // set the cookie's expiration date to a past date
    let cookieString = `${encode(name)}=; expires=${pastDate}`
    if (domain) cookieString += `; domain=${domain}`
    if (path) cookieString += `; path=${path}`
    if (secure) cookieString += '; secure'
    if (httpOnly) cookieString += '; HttpOnly'
    if (sameSite) cookieString += `; SameSite=${sameSite}`
    if (partitioned) cookieString += '; Partitioned'
    if (priority) cookieString += `; Priority=${priority}`
    if (signed) console.warn('Signed cookies are not supported in the frontend.')
    document.cookie = cookieString
  }
  res.download = () => { return res } // stubbed out
  res.end = () => { res.writableEnded = true; res.writableFinished = true; return res } // nothing is sent over the wire, but the flags it sets are observable
  res.format = () => { return res } // stubbed out
  res.get = (name) => headers.get(headerKey(name))?.value
  res.json = (json) => {
    console.log(json)
    return res
  }
  res.jsonp = () => { return res } // stubbed out
  res.links = () => { return res } // stubbed out
  res.location = (url) => res.set('Location', url)
  res.redirect = (status, route) => {
    if (!route) route = status
    handleRoute({ route })
    return res
  }
  // res.render is defined below
  res.send = () => { return res } // stubbed out
  res.sendFile = () => { return res } // stubbed out
  res.sendStatus = () => { return res } // stubbed out
  res.set = (name, value) => {
    if (name && typeof name === 'object') { // res.set() accepts an object of several headers at once
      for (const [key, val] of Object.entries(name)) res.set(key, val)
      return res
    }
    headers.set(headerKey(name), { name, value })
    return res
  }
  res.header = res.set // express aliases these
  res.status = (code) => { res.statusCode = code; return res }
  res.type = (type) => res.set('Content-Type', type)
  res.vary = (field) => res.append('Vary', field)

  // properties and methods from the native Node.js http.ServerResponse and http.OutgoingMessage APIs that express's response object inherits from; nothing is ever written to a socket in the browser, so these record what they are given where that is observable and otherwise do nothing; see https://nodejs.org/api/http.html#class-httpserverresponse
  res.connection = null
  res.finished = false
  res.sendDate = true
  res.socket = null
  res.statusCode = 200
  res.statusMessage = 'OK'
  res.strictContentLength = false
  res.writableEnded = false
  res.writableFinished = false
  res.addTrailers = () => {}
  res.appendHeader = (name, value) => res.append(name, value)
  res.cork = () => {}
  res.uncork = () => {}
  res.flushHeaders = () => {}
  res.getHeader = (name) => headers.get(headerKey(name))?.value
  res.getHeaderNames = () => [...headers.values()].map(header => headerKey(header.name))
  res.getHeaders = () => Object.fromEntries([...headers.values()].map(header => [headerKey(header.name), header.value]))
  res.hasHeader = (name) => headers.has(headerKey(name))
  res.removeHeader = (name) => { headers.delete(headerKey(name)) }
  res.setHeader = (name, value) => { headers.set(headerKey(name), { name, value }); return res }
  res.setTimeout = () => res
  res.write = () => true
  res.writeContinue = () => {}
  res.writeEarlyHints = () => {}
  res.writeHead = (statusCode, statusMessage, suppliedHeaders) => {
    res.statusCode = statusCode
    if (typeof statusMessage === 'string') res.statusMessage = statusMessage
    else suppliedHeaders = statusMessage
    if (suppliedHeaders) for (const [name, value] of Object.entries(suppliedHeaders)) res.setHeader(name, value)
    return res
  }
  res.writeProcessing = () => {}
  res.destroy = () => res
  res.destroyed = false
  res.writable = true
  res.addListener = () => res
  res.emit = () => false
  res.off = () => res
  res.on = () => res
  res.once = () => res
  res.removeAllListeners = () => res
  res.removeListener = () => res

  defaultReq.res = res // apply the response object to the default request object

  // #endregion

  // #region single-page-express methods

  // the routing settings the route matchers are compiled against, read fresh so that changing them later still takes effect
  function routingSettings () {
    return {
      expressVersion: app.expressVersion,
      sensitive: !!app.appVars['case sensitive routing'], // express matches routes case insensitively unless case sensitive routing is enabled
      strict: !!app.appVars['strict routing']
    }
  }

  // if it's a registered route, fire its event; if it's not, let the browser handle it natively
  async function handleRoute (params) {
    let route = params.route
    const method = params.method ? ('' + params.method).toLowerCase() : 'get' // http method from the request

    // check if it's a registered route
    const settings = routingSettings()
    let routeWithoutQuery = route.split('?')[0] // TODO: handle links without href attributes

    // remove trailing `/` if it exists and if strict routing is disabled
    if (!settings.strict && routeWithoutQuery.length > 1 && routeWithoutQuery.endsWith('/')) routeWithoutQuery = routeWithoutQuery.slice(0, -1)

    // only a route decides whether to hijack the event; middleware alone must not turn every link into a single page navigation
    const match = routerHandlesRequest(app.router, routeWithoutQuery, method, settings)

    if (match) {
      // it's a registered route, so hijack the event
      params.event?.preventDefault()

      // show top bar
      scheduleTopbar(routeWithoutQuery)

      // save scroll position of current page before moving to the next page
      app.urls[currentRoute] = {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollingChildContainers: {}
      }

      // save scroll position of child containers that scroll too, so long as they have ids
      for (const scrollingChildContainer of document.querySelectorAll('[id]')) {
        if (scrollingChildContainer.scrollHeight > scrollingChildContainer.clientHeight || scrollingChildContainer.scrollWidth > scrollingChildContainer.clientWidth) {
          app.urls[currentRoute].scrollingChildContainers[scrollingChildContainer.id] = {
            scrollX: scrollingChildContainer.scrollLeft,
            scrollY: scrollingChildContainer.scrollTop
          }
        }
      }
      currentRoute = routeWithoutQuery // from here on, this is the page on screen

      // alter browser history state
      if (method === 'get' && !params.skipHistory) {
        currentIndex++
        window.history.pushState({ index: currentIndex }, '', route)
      }

      // build request object
      const req = { ...defaultReq }

      // req.body
      if (params.parseBody || params.body) {
        if (params.event?.target) { // it's possible to submit the form using app.triggerRoute, in which case there won't be form data
          req.body = Object.fromEntries(new FormData(params.event.target).entries()) // convert the form entries into key/value pairs
          if (params.event.submitter) req.body[params.event.submitter.name] = params.event.submitter.value // add which button was clicked to req.body
        } else if (params.body) req.body = params.body // use manually submitted request body if it is provided instead
        else req.body = {} // otherwise set req.body to an empty object
        if (app.expressVersion > 4 && req.body && Object.keys(req.body).length === 0) req.body = undefined // if req.body is an empty object and the express version is 5+ then set req.body to undefined to match the express api
      }

      // req.cookies
      req.cookies = {}
      for (const cookie of document.cookie.split('; ')) {
        const separator = cookie.indexOf('=')
        if (separator < 1) continue // skip an empty cookie jar and any malformed entries
        req.cookies[decodeURIComponent(cookie.slice(0, separator))] = decodeURIComponent(cookie.slice(separator + 1)) // cookie values are allowed to contain `=`
      }

      req.method = method
      req.originalUrl = route

      req.params = {} // the dispatcher fills this in from each layer that matches as it walks the stack

      // req.path and req.protocol
      const parsedUrl = new URL(window.location.href)
      req.path = parsedUrl.pathname
      req.protocol = parsedUrl.protocol.replace(':', '') // express reports the protocol without a trailing colon

      // req.query
      if (app.appVars['query parser']) {
        const parts = route.split('?') // split the route by question marks
        route = parts[0] // the first part is the route
        const queryString = parts.slice(1).join(', ') // all the remaining parts are the query params
        req.query = Object.fromEntries(new URLSearchParams(queryString).entries()) // convert the query string into key/value pairs
      }

      req.secure = req.protocol === 'https'

      // req.subdomains
      const parts = req.hostname.split('.')
      const subdomains = parts.slice(0, -parseInt(app.appVars['subdomain offset']))
      req.subdomains = subdomains.reverse()

      // attach req object to res
      res.req = req

      // pass along whether the back button or forward button was pressed
      req.backButtonPressed = params.backButtonPressed
      req.forwardButtonPressed = params.forwardButtonPressed

      // add back/forward button classes to the html element
      const htmlEl = document.querySelector('html')
      if (params.backButtonPressed) {
        htmlEl.classList.add('backButtonPressed')
        htmlEl.classList.remove('forwardButtonPressed')
      } else if (params.forwardButtonPressed) {
        htmlEl.classList.remove('backButtonPressed')
        htmlEl.classList.add('forwardButtonPressed')
      } else {
        htmlEl.classList.remove('backButtonPressed')
        htmlEl.classList.remove('forwardButtonPressed')
      }

      // walk the middleware and route stack
      req.url = routeWithoutQuery
      req.baseUrl = ''
      req.singlePageExpressCalledParams = new Map() // tracks which param callbacks have already run for this request
      const handled = { done: false }
      const unhandledError = await dispatchRouter(app.router, req, res, settings, {
        pathname: routeWithoutQuery,
        baseUrl: '',
        params: {},
        error: null,
        handled
      })
      if (unhandledError) { // nothing in the stack handled the error, so report it the way express's default error handler would
        console.error('single-page-express: unhandled error in a route or middleware:')
        console.error(unhandledError)
      }

      // scroll the page appropriately
      const scrollPage = () => {
        // if this page has never been visited before or res.resetScroll or app.alwaysScrollTop is present
        if (!app.urls[routeWithoutQuery] || res.resetScroll || app.alwaysScrollTop) {
          window.scrollTo(0, 0) // scroll to the top
          if (res.resetScroll && app.urls[routeWithoutQuery]) {
            delete app.urls[routeWithoutQuery].scrollX
            delete app.urls[routeWithoutQuery].scrollY
            delete app.urls[routeWithoutQuery].scrollingChildContainers
          }
        } else if (app.urls[routeWithoutQuery]) { // if this page has been visited before
          window.scrollTo(app.urls[routeWithoutQuery].scrollX || 0, app.urls[routeWithoutQuery].scrollY || 0) // restore the previous scroll position
          // restore the position of scrollable containers
          for (const scrollingChildContainer in app.urls[routeWithoutQuery].scrollingChildContainers) {
            if (document.getElementById(scrollingChildContainer)) {
              document.getElementById(scrollingChildContainer).scrollTo(app.urls[routeWithoutQuery].scrollingChildContainers[scrollingChildContainer].scrollX || 0, app.urls[routeWithoutQuery].scrollingChildContainers[scrollingChildContainer].scrollY || 0)
            }
          }
        }
        res.resetScroll = null // clear this var so it does not persist on the next request; allow routes to opt-in

        // a backstop: the bar is normally taken down the moment the render has markup, which is well before this, but a navigation that settles without having got that far should not leave one on screen
        contentReady()
      }
      // the render runs this once its update is done, because it is the only thing that knows when that is
      pageSettledCallback = scrollPage
    }
  }

  // runs the supplied html validator against post-rendered markup and reports whatever it finds; the validator is supplied by the user rather than bundled, so that people who do not want it pay nothing for it; see the docs for htmlValidator
  function validateMarkup (markup, template) {
    if (!app.htmlValidator) return null

    let report
    try {
      if (typeof app.htmlValidator.validateStringSync === 'function') report = app.htmlValidator.validateStringSync(markup)
      else if (typeof app.htmlValidator.validateString === 'function') report = app.htmlValidator.validateString(markup)
      else {
        console.error('single-page-express: the htmlValidator supplied has neither a `validateStringSync` nor a `validateString` method; supply an html-validate instance or something with a compatible api.')
        app.htmlValidator = null // there is no point complaining about this on every render
        return null
      }
    } catch (error) {
      console.error(`single-page-express: the htmlValidator threw while checking the template: ${template}`)
      console.error(error)
      return null
    }

    // a validator that works asynchronously is still reported, but it never delays the render
    if (report && typeof report.then === 'function') {
      report.then(resolved => reportHtmlValidation(resolved, template), error => {
        console.error(`single-page-express: the htmlValidator rejected while checking the template: ${template}`)
        console.error(error)
      })
      return report
    }

    reportHtmlValidation(report, template)
    return report
  }

  // logs the messages in an html validation report; validation never blocks a render, it only tells you what is wrong
  function reportHtmlValidation (report, template) {
    if (!report || report.valid) return
    for (const result of report.results || []) {
      for (const message of result.messages || []) {
        const rule = message.ruleId ? ` [${message.ruleId}]` : ''
        const text = `single-page-express: invalid html in the post-rendered template '${template}' at line ${message.line}, column ${message.column}: ${message.message}${rule}`
        if (message.severity === 1) console.warn(text) // html-validate uses 1 for warnings and 2 for errors
        else console.error(text)
      }
    }
  }

  // app.render implements the express api on the surface, then prescribes some default behavior specific to this module, provides a default method for dom manipulation, and allows for a user to override the default dom manipulation behaviors
  app.render = function (template, model, callback) {
    model = model || {}

    // clear all `this` variables so they do not persist but store local copies for this method invocation's use
    const thisTitle = this.title
    const thisBeforeRender = this.beforeRender
    const thisTarget = this.target
    const thisAppendTargets = this.appendTargets
    const thisFocus = this.focus
    const thisRemoveMetaTags = this.removeMetaTags
    const thisRemoveStyleTags = this.removeStyleTags
    const thisRemoveLinkTags = this.removeLinkTags
    const thisRemoveScriptTags = this.removeScriptTags
    const thisRemoveBaseTags = this.removeBaseTags
    const thisRemoveTemplateTags = this.removeTemplateTags
    const thisRemoveHeadTags = this.removeHeadTags
    const thisSkipViewTransition = this.skipViewTransition
    const thisUpdateDelay = this.updateDelay
    const thisAfterRender = this.afterRender
    this.title = null
    this.beforeRender = null
    this.target = null
    this.appendTargets = null
    this.focus = null
    this.removeMetaTags = null
    this.removeStyleTags = null
    this.removeLinkTags = null
    this.removeScriptTags = null
    this.removeBaseTags = null
    this.removeTemplateTags = null
    this.removeHeadTags = null
    this.skipViewTransition = null
    this.updateDelay = null
    this.afterRender = null

    const postRenderCallbacks = () => {
      // fire post-render callback for this template if it exists
      if (app.postRenderCallbacks[template]) {
        if (typeof app.postRenderCallbacks[template] === 'function') {
          app.postRenderCallbacks[template](model)
        } else console.error(`single-page-express: post-render callback for ${template} is not a function.`)
      }

      // fire a post-render callback registered for all templates if it exists
      for (const key in app.postRenderCallbacks) {
        if (key.startsWith('*')) { // this allows both * and *all syntax for both express 4 and 5 compatibility
          if (typeof app.postRenderCallbacks[key] === 'function') app.postRenderCallbacks[key](model)
          else console.error(`single-page-express: post-render callback for ${key} is not a function.`)
          break
        }
      }
    }

    if (options.renderMethod) {
      // execute user-supplied render method if it is provided
      options.renderMethod(template, model, callback)
      postRenderCallbacks()
    } else {
      // execute default render method if the user does not supply one
      let err

      // if no templates exist at all, log the render method arguments to the console and display a warning that no templates are loaded
      if (!err && !app.templates) {
        err = 'single-page-express: no templates are loaded.'
        console.log('template:', template)
        console.log('model:', model)
      }

      if (!err && typeof app.templatingEngine?.render !== 'function') {
        err = 'single-page-express: no template engine is loaded or the engine supplied does not have a `render` method; please use a templating engine that is compatible with Express'
        console.error(err)
      }

      if (!err && !app.templates[template]) {
        err = `single-page-express: attempted to render template which does not exist: ${template}`
        console.error(err)
      }

      let markup = ''
      let htmlValidation = null
      if (!err) {
        // render the template with the chosen templating system
        try {
          markup = app.templatingEngine.render(template, model)
          htmlValidation = validateMarkup(markup, template) // check the post-rendered markup if a validator was supplied
        } catch (error) {
          const msg = `single-page-express: error parsing post-rendered template: ${template}`
          console.error(msg)
          console.error(error.message)
          err = msg + '\n' + error.message
        }

        if (!err) {
          // build a dom from the rendered markup
          let doc
          try {
            doc = parser.parseFromString(markup, 'text/html')
          } catch (error) {
            const msg = `single-page-express: error parsing post-rendered template: ${template}`
            console.error(msg)
            console.error(error.message)
            err = msg + '\n' + error.message
          }

          if (!err) {
            // replace title tag with the new one
            if (thisTitle) { // check if res.title is set
              if (document.querySelector('title')) { // check if the title element exists
                document.querySelector('title').innerHTML = thisTitle // replace the page title with the new title from res.title
              }
            } else if (doc.querySelector('title') && document.querySelector('title')) { // otherwise check if a <title> tag exists in the template
              document.querySelector('title').innerHTML = doc.querySelector('title').innerHTML // if so, replace the page title with the new title from the <title> tag
            }

            // determine the targets
            let targets
            if (thisTarget) {
              if (Array.isArray(thisTarget)) targets = thisAppendTargets ? app.defaultTargets.concat(thisTarget) : thisTarget
              else targets = thisAppendTargets ? app.defaultTargets.concat([thisTarget]) : [thisTarget]
            } else targets = app.defaultTargets

            // call beforeRender methods if they exist
            const beforeAfterRenderArg = {
              model,
              markup,
              doc,
              targets,
              htmlValidation
            }
            if (app.beforeEveryRender && typeof app.beforeEveryRender === 'function') app.beforeEveryRender(beforeAfterRenderArg) // call app.beforeEveryRender function if it exists
            if (thisBeforeRender && typeof thisBeforeRender === 'function') thisBeforeRender(beforeAfterRenderArg) // call res.beforeRender function if it exists

            // remove tags from the head tag if any res.remove* properties are set
            if (thisRemoveMetaTags) for (const tag of document.querySelectorAll('head meta')) tag.remove() // res.removeMetaTags
            if (thisRemoveStyleTags) for (const tag of document.querySelectorAll('head style')) tag.remove() // res.removeStyleTags
            if (thisRemoveLinkTags) for (const tag of document.querySelectorAll('head link')) tag.remove() // res.removeLinkTags
            if (thisRemoveScriptTags) for (const tag of document.querySelectorAll('head script')) tag.remove() // res.removeScriptTags
            if (thisRemoveBaseTags) for (const tag of document.querySelectorAll('head base')) tag.remove() // res.removeBaseTags
            if (thisRemoveTemplateTags) for (const tag of document.querySelectorAll('head template')) tag.remove() // res.removeTemplateTags
            if (thisRemoveHeadTags) for (const tag of document.querySelectorAll('head > :not(title)')) tag.remove() // res.removeHeadTags

            // update the attributes of the html tag and head tag; preexisting attributes will not be removed; only new ones added or old ones updated
            for (const attrib of doc.documentElement.attributes) document.documentElement.setAttribute(attrib.name, attrib.value)
            for (const attrib of doc.head.attributes) document.head.setAttribute(attrib.name, attrib.value)

            // add any new tags to the head tag from the new page that aren't present in the previous page
            const oldHeadElements = Array.from(document.head.children)
            const newHeadElements = Array.from(doc.head.children)
            const oldHeadElementsStrings = oldHeadElements.map(el => el.outerHTML) // for comparison
            const diffElements = newHeadElements.filter(el => !oldHeadElementsStrings.includes(el.outerHTML)) // figure out which head elements are new

            // wait until link tags finish loading before updating the DOM to prevent a FOUC https://en.wikipedia.org/wiki/Flash_of_unstyled_content
            const linkTagsInDiff = diffElements.filter(el => el.tagName.toLowerCase() === 'link')
            const loadPromises = []
            for (const linkTag of linkTagsInDiff) loadPromises.push(new Promise((resolve) => { linkTag.addEventListener('load', () => resolve()) }))

            // wait until script tags finish loading before updating the DOM to prevent a FOUC https://en.wikipedia.org/wiki/Flash_of_unstyled_content
            for (const tag of diffElements) {
              // if the script tag is for a new script, don't update the DOM until it finishes loading
              if (tag.nodeName === 'SCRIPT' && !document.querySelector(`script[src="${tag.src}"]`) && !document.querySelector(`script[src="${tag.src.replace(window.location.origin, '')}"]`)) {
                const script = document.createElement('script')
                script.src = tag.src
                script.type = 'text/javascript'
                script.async = true
                loadPromises.push(new Promise((resolve) => { script.onload = () => resolve() }))
                document.head.appendChild(script)
              } else document.head.appendChild(tag) // if it's a script we've already seen before, we don't need to wait for it
            }

            // update DOM after all link tags and script tags have finished loading
            Promise.all(loadPromises).then(() => {
              window.setTimeout(async () => {
                const domUpdate = () => {
                  let updatedATarget = false

                  // write the new markup into each target
                  for (const target of targets) {
                    const targetEl = document.querySelector(target)
                    if (!targetEl) { // the target must be a valid DOM element
                      const msg = `single-page-express: invalid target supplied: ${target}`
                      console.error(msg)
                      err = msg
                      continue
                    }
                    updatedATarget = true
                    const propertyToUpdate = targetEl.nodeName === 'BODY' ? 'innerHTML' : 'outerHTML' // if targetEl is a body tag, update innerHTML, otherwise outerHTML; this prevents duplicate head tags from being inserted into the DOM
                    if (doc.querySelector(target)) { // if the new template has an element with the same id as the target container, then that's the container we're writing to
                      targetEl[propertyToUpdate] = doc.querySelector(target).outerHTML // replace the target with the contents of the template's target id
                    } else if (doc.body) {
                      targetEl[propertyToUpdate] = doc.body.innerHTML // replace the target with the contents of body from the template
                    } else {
                      targetEl[propertyToUpdate] = doc.innerHTML // replace the target with the contents of the entire template
                    }
                  }

                  // the remaining work applies to the render as a whole, so it happens once after every target has been written
                  if (updatedATarget) {
                    announcePageChange()
                    setFocus()

                    // call afterRender methods if they exist
                    if (typeof app.afterEveryRender === 'function') app.afterEveryRender(beforeAfterRenderArg) // call app.afterEveryRender function if it exists
                    if (typeof thisAfterRender === 'function') thisAfterRender(beforeAfterRenderArg) // call res.afterRender function if it exists
                  }

                  // call user-defined callback supplied to the render method if it exists
                  if (callback && typeof callback === 'function') callback(err, markup)

                  postRenderCallbacks()
                }

                // announce the page change to screen readers
                function announcePageChange () {
                  const announcementContentElement = document.querySelector('[data-page-title]') || document.querySelector('h1[aria-label]') || document.querySelector('h1') || document.querySelector('title')
                  if (!announcementContentElement) return // there is nothing meaningful to announce
                  let liveRegion = document.getElementById(ariaLiveRegionId)
                  if (!liveRegion) {
                    liveRegion = document.createElement('p')
                    liveRegion.id = ariaLiveRegionId
                    liveRegion.setAttribute('aria-live', 'assertive')
                    liveRegion.setAttribute('aria-atomic', 'true')
                    Object.assign(liveRegion.style, ariaLiveRegionStyles)
                    document.body.appendChild(liveRegion)
                  }
                  liveRegion.textContent = '' // clear before announcing
                  liveRegion.textContent = announcementContentElement.textContent
                }

                // set browser focus to the declared focus element, or else to the first target
                function setFocus () {
                  const validElementsForOutline = ['A', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'FIELDSET'] // list of elements that are okay to have a visible outline (mostly a problem in just safari; other browsers' default styles don't apply outlines to literally everything that is `focus()`ed)
                  let focusEl = (thisFocus ? document.querySelector(thisFocus) : null) || document.body.querySelector('[autofocus]') // see if there's a declared focus element
                  if (focusEl?.closest('[inert], [aria-disabled], [aria-hidden="true"]')) focusEl = null // don't focus elements that have been declared inert
                  if (focusEl && focusEl !== document.activeElement) {
                    focusEl.focus() // only focus if not already focused
                    if (!validElementsForOutline.includes(focusEl.tagName)) focusEl.style.outline = 'none'
                  } else if (!focusEl) { // focus the target element instead (defined as the first element that appears in the targets array)
                    const targetEl = document.querySelector(targets[0])
                    if (!targetEl) return
                    // apply a tabindex attribute to allow focusing non-focusable elements
                    const originalTabindex = targetEl.getAttribute('tabindex')
                    targetEl.setAttribute('tabindex', '-1')
                    targetEl.focus({ preventScroll: true })
                    if (!validElementsForOutline.includes(targetEl.tagName)) targetEl.style.outline = 'none'
                    if (originalTabindex !== null) targetEl.setAttribute('tabindex', originalTabindex)
                  }
                }
                // this render claims whatever navigation is waiting on it, so that a transition interrupted by the next navigation settles its own page rather than consuming the one that interrupted it
                const settleThisPage = claimPageSettledCallback()
                await contentReady() // there is markup to show, so the top bar has finished reporting; let it play out before anything captures the page

                if (document.startViewTransition && !thisSkipViewTransition && !app.alwaysSkipViewTransition) {
                  currentViewTransition = document.startViewTransition(domUpdate)
                  currentViewTransition.finished.then(settleThisPage, settleThisPage) // a transition that is skipped or interrupted still has to settle the page
                } else {
                  domUpdate()
                  window.setTimeout(settleThisPage, parseInt(thisUpdateDelay) || parseInt(app.updateDelay) || 0) // give a css animation the same amount of time the update itself was given
                }
              }, parseInt(thisUpdateDelay) || parseInt(app.updateDelay) || 0)
            })
          }
        }
      }
    }
  }
  res.render = app.render // they are slightly different methods in express but there is no reason to differentiate between them here

  // #endregion

  // #region start the router

  if (!document.singlePageExpressEventListenerAdded) {
    // listen for link navigation events
    document.addEventListener('click', (event) => {
      if (event.target.tagName === 'A' && event.target.href) handleRoute({ route: event.target.getAttribute('href'), event })
    })

    // listen for form submits
    document.addEventListener('submit', (event) => {
      if (event.target.getAttribute('action')) handleRoute({ route: event.target.getAttribute('action'), event, parseBody: true, method: event.target.getAttribute('method') })
    })
  }
  document.singlePageExpressEventListenerAdded = true // prevent attaching the event to the DOM twice

  // listen for back/forward button properly; the entry the page was loaded on has no history state of its own, and without giving it one the back button cannot return to the page the user started on
  if (typeof window.history.state?.index !== 'number') window.history.replaceState({ ...window.history.state, index: 0 }, '', window.location.href)
  let currentIndex = window.history.state.index
  if (!window.singlePageExpressGlobalsInitialized) {
    window.singlePageExpressGlobalsInitialized = true // this check prevents the event listener from being loaded multiple times if this constructor gets executed more than once
    window.addEventListener('popstate', (event) => {
      const state = event.state
      if (!state) return
      let backButtonPressed = false
      let forwardButtonPressed = false
      const newIndex = state.index
      if (newIndex < currentIndex) backButtonPressed = true
      else if (newIndex > currentIndex) forwardButtonPressed = true
      currentIndex = newIndex
      handleRoute({
        route: window.location.pathname,
        method: 'get',
        skipHistory: true, // skipHistory prevents adding a new entry to history when responding to a back/forward button request
        backButtonPressed,
        forwardButtonPressed
      })
    })
  }

  // #endregion

  return app
}

// see https://expressjs.com/en/5x/api.html#router
singlePageExpress.Router = (routerOptions) => createRouter(routerOptions)

// an html-validate config to hand the htmlValidator param, for anyone who does not want to work out which of its rules a rendered template can actually satisfy
//
// the two rules turned off here are about how markup is written by hand, and what gets checked is markup a templating engine produced rather than anything anybody typed: an engine that renders through the DOM, which most of them do in a browser, gets every boolean attribute written back with an empty value, so `defer` arrives as `defer=""` however the template spelled it and no edit to a template could satisfy them
//
// pass it as it is, or spread it into a config of your own; every rule that finds a real problem is left on
singlePageExpress.htmlValidateConfig = Object.freeze({
  extends: ['html-validate:recommended'],
  rules: Object.freeze({
    'attribute-boolean-style': 'off',
    'attribute-empty-style': 'off'
  })
})

module.exports = singlePageExpress
