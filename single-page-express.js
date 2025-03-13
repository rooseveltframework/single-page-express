const pathToRegexpMatch = require('path-to-regexp').match // route parser for express 5+
const pathToRegexpMatchExpress4 = require('path-to-regexp-express4') // route parser for express 4; express 3 and below are not supported
const parser = new window.DOMParser() // used by the default render method

function singlePageExpress (options) {
  // #region constructor params and top-level variable declarations
  const app = {} // instance of the router app
  app.expressVersion = options.expressVersion // which version of the express api to target
  if (app.expressVersion !== 5 && (parseInt(app.expressVersion) <= 4)) app.expressVersion = 4 // permit express 4 and 5+
  if (!app.expressVersion) app.expressVersion = 4 // default to express 4
  app.appVars = {} // for app.set() / app.get()
  app.templatingEngine = options.templatingEngine // which templating engine to use
  app.templates = options.templates // templates to render
  if (!app.templates) console.warn('single-page-express: no templates are loaded; as such the default render method will just print the template name and model to the console.')
  app.routes = {} // list of functions to execute when trying to see if this route matches one of the known patterns indexed by original route method#string
  app.routeCallbacks = {} // list of functions to execute when the route is invoked
  app.defaultTarget = options.defaultTarget // which element to replace by default
  app.beforeEveryRender = options.beforeEveryRender // function to execute before every DOM update if using the default render method
  app.updateDelay = options.updateDelay // how long to delay after executing app.beforeEveryRender or this.beforeRender before performing the DOM update
  app.afterEveryRender = options.afterEveryRender // function to execute after every DOM update if using the default render method
  app.postRenderCallbacks = {} // list of callback functions to execute after a render event occurs
  app.topbarEnabled = !options.disableTopbar // whether to use topbar https://buunguyen.github.io/topbar/
  app.topBarRoutes = options.topBarRoutes // which routes to use the topbar on; defaults to all if this option is not supplied
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
  app.alwaysScrollTop = options.alwaysScrollTop // always scroll to the top of the page after every render
  app.urls = {} // list of URLs that have been visited and metadata about them

  // taken from https://expressjs.com/en/api.html#routing-methods
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
  app.locals = {} // stubbed out
  app.mountpath = '' // stubbed out

  // express app object events
  app.mount = () => {} // stubbed out

  // express app object methods
  app.all = (route, callback) => { registerRoute('all', route, callback) }
  app.delete = (route, callback) => { registerRoute('delete', route, callback) }
  app.disable = (name) => { app.appVars[name] = false }
  app.disabled = (name) => { return !app.appVars[name] }
  app.enable = (name) => { app.appVars[name] = true }
  app.enabled = (name) => { return !!app.appVars[name] }
  app.engine = () => {} // stubbed out
  app.get = (name, callback) => { // in the express docs, this method is overloaded and can be used for more than one thing based on the number of arguments
    if (!callback) return app.appVars[name]
    else return registerRoute('get', name, callback)
  }
  app.listen = () => {} // stubbed out
  httpVerbs.forEach(method => { // app.METHOD
    // some method names are overloaded and can be used for more than one thing based on the number of arguments
    if (!app[method]) app[method] = (route, callback) => { registerRoute(method, route, callback) }
  })
  app.param = () => {} // stubbed out
  app.path = () => {} // stubbed out
  app.post = (route, callback) => { registerRoute('post', route, callback) }
  app.put = (route, callback) => { registerRoute('put', route, callback) }
  // app.render will be defined below
  app.route = (route) => {
    const ret = { route }
    httpVerbs.forEach(method => { ret[method] = (callback) => { registerRoute(method, route, callback) } })
    return ret
  }
  app.set = (name, val) => { app.appVars[name] = val }
  app.use = () => {} // stubbed out
  app.triggerRoute = handleRoute // single-page-express-exclusive method

  // #endregion

  // #region request object

  const defaultReq = {} // this is later extended during a "request" cycle

  // request object properties
  defaultReq.app = app
  defaultReq.baseUrl = '' // stubbed out
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
  defaultReq.param = () => {} // stubbed out
  defaultReq.range = () => {} // stubbed out

  // new properties
  defaultReq.singlePageExpress = true

  // #endregion

  // #region response object

  const res = {}

  // response object properties
  res.app = app
  res.headersSent = false // stubbed out
  res.locals = {} // stubbed out
  // res.req defined at runtime below

  // response object methods
  res.append = () => { return res } // stubbed out
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
  res.end = () => { return res } // stubbed out
  res.format = () => { return res } // stubbed out
  res.get = () => { return res } // stubbed out
  res.json = (json) => {
    console.log(json)
    return res
  }
  res.jsonp = () => { return res } // stubbed out
  res.links = () => { return res } // stubbed out
  res.location = () => { return res } // stubbed out
  res.redirect = (status, route) => {
    if (!route) route = status
    handleRoute({ route })
    return res
  }
  // res.render is defined below
  res.send = () => { return res } // stubbed out
  res.sendFile = () => { return res } // stubbed out
  res.sendStatus = () => { return res } // stubbed out
  res.set = () => { return res } // stubbed out
  res.status = () => { return res } // stubbed out
  res.type = () => { return res } // stubbed out
  res.vary = () => { return res } // stubbed out
  defaultReq.res = res // apply the response object to the default request object

  // #endregion

  // #region single-page-express methods

  // add a route to the route list
  function registerRoute (method, route, callback) {
    // if the method is 'all' then we need to call this function for every method
    if (method === 'all') {
      httpVerbs.forEach(method => { registerRoute(method, route, callback) })
      return
    }

    // if the function receives one argument, then route is the callback, and the actual route needs to be defined from `this`
    if (typeof route !== 'string' && typeof route === 'function') {
      callback = route
      route = this.route
    }

    // flatten if case insensitivity is enabled
    if (app.appVars['case sensitive routing']) route = route.toLowerCase()

    // remove trailing `/` if it exists if strict routing is disabled
    if (!app.appVars['strict routing'] && route.endsWith('/') && route !== '/') route = route.slice(0, -1)

    // check if route is already registered
    if (!(route in app.routes)) {
      // determine which route matching method to use
      let matcher
      if (app.expressVersion === 5) {
        try {
          matcher = pathToRegexpMatch(route) // the newer version of path-to-regexp returns a matching function
        } catch (error) {
          console.error(`single-page-express: failed to register the route '${route}' because it could not be parsed.`)
          if (route.includes('*')) console.error('single-page-express: routes with \'*\' in them should be written like \'*all\' instead in Express 5+ syntax.')
          console.error(error)
        }
      } else matcher = pathToRegexpMatchExpress4(route) // the older version of path-to-regexp returns a matching regular expression

      // register the route
      app.routes[`${method}#${route}`] = {
        method,
        route,
        matcher
      }
      app.routeCallbacks[`${method}#${route}`] = callback
    }
  }

  // if it's a registered route, fire its event; if it's not, let the browser handle it natively
  async function handleRoute (params) {
    let route = params.route
    const method = params.method ? ('' + params.method).toLowerCase() : 'get' // http method from the request

    // check if it's a registered route
    let match
    let routeWithoutQuery = route.split('?')[0]

    // flatten if case insensitivity is enabled
    if (app.appVars['case sensitive routing']) routeWithoutQuery = routeWithoutQuery.toLowerCase()

    // remove trailing `/` if it exists and if strict routing is disabled
    if (!app.appVars['strict routing'] && routeWithoutQuery.endsWith('/')) routeWithoutQuery = routeWithoutQuery.slice(0, -1)

    // loop through route matcher functions to see if any of them match this url pattern
    for (const registeredRoute in app.routes) {
      const potentialMatch = app.routes[registeredRoute]
      if (potentialMatch.method !== method) continue // the registered route's declared method must match the request method
      if (app.expressVersion === 5) potentialMatch.data = potentialMatch.matcher(routeWithoutQuery) // the newer version of path-to-regexp returns a matching function
      else potentialMatch.data = potentialMatch.matcher.exec(routeWithoutQuery) // the older version of path-to-regexp returns a matching regular expression
      if (potentialMatch.data) {
        match = potentialMatch
        break
      }
    }

    if (match) {
      // it's a registered route, so hijack the event
      params.event?.preventDefault()

      // show top bar
      if ((app.topbarEnabled && !app.topBarRoutes) || app.topBarRoutes?.includes?.(match.route)) app.topbar.show()

      // save scroll position of current page before moving to the next page
      app.urls[window.location.pathname] = {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollingChildContainers: {}
      }

      // save scroll position of child containers that scroll too, so long as they have ids
      for (const scrollingChildContainer of document.querySelectorAll('[id]')) {
        if (scrollingChildContainer.scrollHeight > scrollingChildContainer.clientHeight || scrollingChildContainer.scrollWidth > scrollingChildContainer.clientWidth) {
          app.urls[window.location.pathname].scrollingChildContainers[scrollingChildContainer.id] = {
            scrollX: scrollingChildContainer.scrollLeft,
            scrollY: scrollingChildContainer.scrollTop
          }
        }
      }

      // alter browser history state
      if (method === 'get' && !params.skipHistory) window.history.pushState({}, '', route)

      // build request object
      const req = { ...defaultReq }

      // req.body
      if (params.parseBody || params.body) {
        if (params.event?.target) { // it's possible to submit the form using app.triggerRoute, in which case there won't be form data
          req.body = Object.fromEntries(new FormData(params.event.target).entries()) // convert the form entries into key/value pairs
          if (params.event.submitter) req.body[params.event.submitter.name] = params.event.submitter.value // add which button was clicked to req.body
        } else if (params.body) req.body = params.body // use manually submitted request body if it is provided instead
        else req.body = {} // otherwise set req.body to an empty object
      }

      // req.cookies
      const cookies = document.cookie.split('; ')
      req.cookies = {}
      cookies.forEach(cookie => {
        const [name, value] = cookie.split('=')
        req.cookies[decodeURIComponent(name)] = decodeURIComponent(value)
      })

      req.method = method
      req.originalUrl = route

      // req.params
      if (app.expressVersion === 5) req.params = match.data.params // the newer version of path-to-regexp just gives us the params
      else {
        // the older version of path-to-regexp does not map the params to key/value pairs, so we have to do it ourselves
        req.params = {}
        const keys = match.route.match(/:([^/]+)/g)?.map(key => key.substring(1)) // extract the keys from the route pattern, if any exist
        if (keys) {
          const vals = match.matcher.exec(match.data[0]) // use the matcher to extract values from the data
          if (vals) for (const [index, key] of keys.entries()) req.params[key] = vals[index + 1] // make an object with key/value pairs, if any params exist
        }
      }

      // req.path and req.protocol
      const parsedUrl = new URL(window.location.href)
      req.path = parsedUrl.pathname
      req.protocol = parsedUrl.protocol

      // req.query
      if (app.appVars['query parser']) {
        const parts = route.split('?') // split the route by question marks
        route = parts[0] // the first part is the route
        const queryString = parts.slice(1).join(', ') // all the remaining parts are the query params
        req.query = Object.fromEntries(new URLSearchParams(queryString).entries()) // convert the query string into key/value pairs
      }

      req.route = match.data
      req.secure = req.protocol === 'https' || req.protocol === 'https:'

      // req.subdomains
      const parts = req.hostname.split('.')
      const subdomains = parts.slice(0, -parseInt(app.appVars['subdomain offset']))
      req.subdomains = subdomains.reverse()

      // attach req object to res
      res.req = req

      // fire the event
      await app.routeCallbacks[`${method}#${match.route}`](req, res)

      // scroll the page appropriately
      window.setTimeout(() => {
        // if this page has never been visited before or res.resetScroll or app.alwaysScrollTop is present
        if (!app.urls[route] || res.resetScroll || app.alwaysScrollTop) {
          window.scrollTo(0, 0) // scroll to the top
          if (res.resetScroll) {
            delete app.urls[route].scrollX
            delete app.urls[route].scrollY
            delete app.urls[route].scrollingChildContainers
          }
        } else if (app.urls[route]) { // if this page has been visited before
          window.scrollTo(app.urls[route].scrollX || 0, app.urls[route].scrollY || 0) // restore the previous scroll position
          // restore the position of scrollable containers
          for (const scrollingChildContainer in app.urls[route].scrollingChildContainers) {
            if (document.getElementById(scrollingChildContainer)) {
              document.getElementById(scrollingChildContainer).scrollTo(app.urls[route].scrollingChildContainers[scrollingChildContainer].scrollX || 0, app.urls[route].scrollingChildContainers[scrollingChildContainer].scrollY || 0)
            }
          }
        }
        res.resetScroll = null // clear this var so it does not persist on the next request; allow routes to opt-in

        // hide top bar (loading completed)
        if ((app.topbarEnabled && !app.topBarRoutes) || app.topBarRoutes?.includes?.(match.route)) app.topbar.hide()
      }, parseInt(res.updateDelay) || parseInt(app.updateDelay) || 0) // delay the scroll until after the render by using the same delay mechanism as the default render method
    }
  }

  // app.render implements the express api on the surface, then prescribes some default behavior specific to this module, provides a default method for dom manipulation, and allows for a user to override the default dom manipulation behaviors
  app.render = function (template, model, callback) {
    model = model || {}

    // clear all `this` variables so they do not persist but store local copies for this method invocation's use
    const thisTitle = this.title
    const thisBeforeRender = this.beforeRender
    const thisTarget = this.target
    const thisFocus = this.focus
    const thisRemoveMetaTags = this.removeMetaTags
    const thisRemoveStyleTags = this.removeStyleTags
    const thisRemoveLinkTags = this.removeLinkTags
    const thisRemoveScriptTags = this.removeScriptTags
    const thisRemoveBaseTags = this.removeBaseTags
    const thisRemoveTemplateTags = this.removeTemplateTags
    const thisRemoveHeadTags = this.removeHeadTags
    const thisUpdateDelay = this.updateDelay
    const thisAfterRender = this.afterRender
    this.title = null
    this.beforeRender = null
    this.target = null
    this.focus = null
    this.removeMetaTags = null
    this.removeStyleTags = null
    this.removeLinkTags = null
    this.removeScriptTags = null
    this.removeBaseTags = null
    this.removeTemplateTags = null
    this.removeHeadTags = null
    this.updateDelay = null
    this.afterRender = null

    if (options.renderMethod) {
      // execute user-supplied render method if it is provided
      options.renderMethod(template, model, callback)
    } else {
      // execute default render method if the user does not supply one
      let err

      // if no templates exist at all, log the render method arguments to the console and display a warning that no templates are loaded
      if (!err && !app.templates) {
        err = 'single-page-express: no templates are loaded.'
        console.log('template:', template)
        console.log('model:', model)
      }

      if (!err && (!app?.templatingEngine.render || typeof app?.templatingEngine?.render !== 'function')) {
        err = 'single-page-express: no template engine is loaded or the engine supplied does not have a `render` method; please use a templating engine that is compatible with Express'
        console.error(err)
      }

      if (!err && !app.templates[template]) {
        err = `single-page-express: attempted to render template which does not exist: ${template}`
        console.error(err)
      }

      let markup = ''
      if (!err) {
        // render the template with the chosen templating system
        try {
          markup = app.templatingEngine.render(template, model)
          // TODO: leverage https://html-validate.org/ — will need to be a peer dep
          // add html-validate to devDependencies
          // const htmlValidate = require('./node_modules/html-validate/dist/cjs/browser.js')
          // console.log(htmlValidate)
          // this seems to crash webpack for some reason
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

            // call app.beforeEveryRender function if it exists
            if (app.beforeEveryRender && typeof app.beforeEveryRender === 'function') app.beforeEveryRender(model) // e.g. document.body.style.opacity = 0

            // call res.beforeRender function if it exists
            if (thisBeforeRender && typeof thisBeforeRender === 'function') thisBeforeRender(model) // e.g. document.body.style.opacity = 0

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
              if (tag.nodeName === 'SCRIPT' && !document.querySelector(`script[src="${tag.src}"]`)) {
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
              window.setTimeout(() => {
                const target = thisTarget || app.defaultTarget // check if a target is set
                let targetEl
                if (target) {
                  if (document.querySelector(target)) { // check if the target is a valid DOM element
                    targetEl = document.querySelector(target)
                    if (doc.querySelector(target)) { // if the new template has an element with the same id as the target container, then that's the container we're writing to
                      targetEl.innerHTML = doc.querySelector(target).innerHTML // replace the target with the contents of the template's target id
                    } else if (doc.body) {
                      targetEl.innerHTML = doc.body.innerHTML // replace the target with the contents of body from the template
                    } else {
                      targetEl.innerHTML = doc.innerHTML // replace the target with the contents of the entire template
                    }
                  } else {
                    const msg = `single-page-express: invalid target supplied: ${target}`
                    console.error(msg)
                    err = msg
                  }
                } else if (doc.body && document.body) {
                  targetEl = document.body
                  targetEl.innerHTML = doc.body.innerHTML
                } else {
                  const msg = `single-page-express: attempted to render ${template} but there was nothing to render`
                  console.warn(msg)
                  err = msg
                }

                // announce the page change to screen readers
                const announcementContentElement = document.querySelector('h1[aria-label]') || document.querySelector('h1') || document.querySelector('title')
                if (!document.getElementById('singlePageExpressDefaultRenderMethodAriaLiveRegion')) {
                  const liveRegion = document.createElement('p')
                  liveRegion.id = 'singlePageExpressDefaultRenderMethodAriaLiveRegion'
                  liveRegion.setAttribute('aria-live', 'assertive')
                  liveRegion.setAttribute('aria-atomic', 'true')
                  liveRegion.style.position = 'absolute'
                  liveRegion.style.top = '-9999px'
                  liveRegion.style.left = '-9999px'
                  liveRegion.style.width = '1px'
                  liveRegion.style.height = '1px'
                  liveRegion.style.overflow = 'hidden'
                  liveRegion.style.border = '0'
                  liveRegion.style.margin = '-1px'
                  liveRegion.style.padding = '0'
                  liveRegion.style.clipPath = 'inset(50%)'
                  liveRegion.style.whiteSpace = 'nowrap'
                  document.body.appendChild(liveRegion)
                }
                document.getElementById('singlePageExpressDefaultRenderMethodAriaLiveRegion').textContent = '' // clear before announcing
                document.getElementById('singlePageExpressDefaultRenderMethodAriaLiveRegion').textContent = announcementContentElement.textContent

                // set browser focus
                let focusEl = document.querySelector(thisFocus) || document.body.querySelector('[autofocus]') // see if there's a declared focus element
                if (focusEl && !focusEl.closest('[inert], [aria-disabled], [aria-hidden="true"]')) focusEl = null // don't focus elements that have been declared inert
                if (focusEl && focusEl !== document.activeElement) focusEl.focus() // only focus if not already focused
                else { // focus the target element instead
                  // apply a tabindex attribute to allow focusing non-focusable elements
                  const originalTabindex = targetEl.getAttribute('tabindex')
                  targetEl.setAttribute('tabindex', '-1')
                  targetEl.focus({ preventScroll: true })
                  if (originalTabindex !== null) targetEl.setAttribute('tabindex', originalTabindex)
                }

                // call app.afterEveryRender function if it exists
                if (app.afterEveryRender && typeof app.afterEveryRender === 'function') app.afterEveryRender(model) // e.g. document.body.style.opacity = 1

                // call res.afterRender function if it exists
                if (thisAfterRender && typeof thisAfterRender === 'function') thisAfterRender(model) // e.g. document.body.style.opacity = 1
              }, parseInt(thisUpdateDelay) || parseInt(app.updateDelay) || 0)
            })
          }
        }
      }

      // call user-defined callback supplied to the render method if it exists
      if (callback && typeof callback === 'function') callback(err, markup)
    }

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
  res.render = app.render // they are slightly different methods in express but there is no reason to differentiate between them here

  // #endregion

  // #region start the router

  if (!document.singlePageExpressEventListenerAdded) {
    // listen for link navigation events
    document.addEventListener('click', (event) => {
      if (event.target.tagName === 'A') handleRoute({ route: event.target.getAttribute('href'), event })
    })

    // listen for form submits
    document.addEventListener('submit', (event) => {
      handleRoute({ route: event.target.getAttribute('action'), event, parseBody: true, method: event.target.getAttribute('method') })
    })
  }
  document.singlePageExpressEventListenerAdded = true // prevent attaching the event to the DOM twice

  // listen for back/forward button properly
  window.addEventListener('popstate', (event) => {
    handleRoute({ route: window.location.pathname, method: 'get', skipHistory: true }) // skipHistory prevents adding a new entry to history when responding to a back/forward button request
  })

  // #endregion

  return app
}

module.exports = singlePageExpress
