## Install

First, install `single-page-express` from npm.

The package is distributed with the following builds available:

- `dist/single-page-express.cjs`: CommonJS bundle: `const singlePageExpress = require('single-page-express')`
- `dist/single-page-express.js`: Standalone bundle that can be included via `<script>` tags. Declares a global variable: `singlePageExpress`
- `dist/single-page-express.min.js`: Minified standalone bundle that can be included via `<script>` tags. Declares a global variable: `singlePageExpress`
- `dist/single-page-express.mjs`: ES module: `import singlePageExpress from 'single-page-express'`
- `dist/single-page-express.min.mjs`: Minified ES module: `import singlePageExpress from 'single-page-express/min'`

## Use

Then, in your frontend code:

```javascript
const templatingEngine = require('') // define which templating engine to use here
const templates = {} // load some templates here
```

For `templatingEngine`, use something like [teddy](https://github.com/rooseveltframework/teddy), [mustache](https://github.com/janl/mustache.js/), or any other templating system that supports Express and works in the browser.

For `templates`, create an object of key/value pairs where the key is the name of the template and the value is the template code.

Once those variables are defined, you can call the `single-page-express` constructor.

Below is an example using Teddy for templating and defining two simple templates.

```javascript
const templatingEngine = require('teddy/client')
const templates = {
  index: '<p>hello world</p>',
  secondPage: '<p>this page has a {variable} in it</p>'
}

// register the templates with Teddy so it can resolve them by name
for (const [name, template] of Object.entries(templates)) templatingEngine.setTemplate(name, template)

const app = require('single-page-express')({
  templatingEngine,
  templates
})
```

Note the registration step. `single-page-express` passes the *name* of a template to your templating engine's `render` method, not the template's source, so the engine needs its own copy of each template to look that name up in. Teddy does that with `teddy.setTemplate(name, template)`. Other engines have their own equivalent, and some accept template source directly and need no registration at all; check the documentation for the engine you're using. If you skip this step with Teddy, it will have nothing to resolve the name against and your renders will print the template name instead of the template.

### Defining routes

The various methods of defining routes [like you would with Express](https://expressjs.com/en/5x/api.html#routing-methods) are supported. These docs target the Express 5 API, which is what `single-page-express` targets by default; see [Targeting Express 4](#targeting-express-4) if you need the Express 4 API instead.

A simple example:

```javascript
app.route('/').get(function (req, res) {
  res.render('index', {})
})

app.route('/secondPage').get(function (req, res) {
  res.render('secondPage', {
    variable: 'variable with contents: "hi there!"'
  })
})
```

Some more examples:

```javascript
// using the app.METHOD syntax
app.get('/routeWithAppDotMethod', function (req, res) {
  res.render('someTemplate', { some: 'model' })
})

// using the app.route('route').METHOD syntax
app.route('/routeWithAppDotRouterDotMethod').get(function (req, res) {
  res.render('someTemplate', { some: 'model' })
})

// route with params
app.route('/route/:with/:params').get(function (req, res) {
  console.log('req.params:', req.params)
  res.render('someTemplate', { some: 'model' })
})

// wildcard route; in express 5 a wildcard must be named
app.route('/*all').get(function (req, res) {
  console.log('req.params.all:', req.params.all)
  res.render('someTemplate', { some: 'model' })
})

// a route that matches every method
app.all('/routeForEveryMethod', function (req, res) {
  res.render('someTemplate', { some: 'model' })
})

// handle a form submit
app.route('/routeWithFormSubmit').post(function (req, res) {
  console.log('req.body:', req.body)
  res.render('someTemplate', { some: 'model' })
})
```

### Middleware

Middleware works the way it does in Express. Register it with `app.use()` and it runs, in registration order, before the route handlers for any path it matches. Call `next()` to hand off to whatever comes next:

```javascript
// runs for every request
app.use(function (req, res, next) {
  req.startedAt = Date.now()
  next()
})

// runs only for paths beginning with /admin
app.use('/admin', function (req, res, next) {
  if (!loggedIn()) return res.redirect('/login')
  next()
})
```

You can also attach middleware to a single route by passing it ahead of the handler, and you can pass as many handlers as you like:

```javascript
app.get('/dashboard', requireLogin, loadUser, function (req, res) {
  res.render('dashboard', { user: req.user })
})
```

Error handling middleware takes four arguments, just as in Express. When a handler calls `next(err)`, throws, or rejects, `single-page-express` skips ahead to the next error handling middleware:

```javascript
app.use(function (err, req, res, next) {
  console.error(err)
  res.render('error', { message: err.message })
})
```

One thing differs from Express, and it is deliberate: **middleware alone will not capture a link.** `single-page-express` only hijacks a click or form submit when a *route* matches it, because middleware registered at `/` would otherwise turn every link on the page, including links to other sites, into a single page app navigation. Middleware still runs for every request that a route does handle.

### Routers

`singlePageExpress.Router()` creates a router you can register routes and middleware on, then mount with `app.use()`, exactly as in Express:

```javascript
const singlePageExpress = require('single-page-express')
const router = singlePageExpress.Router()

router.use(function (req, res, next) {
  // runs for every request this router handles
  next()
})

router.get('/users/:userId', function (req, res) {
  res.render('user', { userId: req.params.userId })
})

app.use('/admin', router)
// the route above now answers to /admin/users/:userId
```

Routers can be mounted on other routers, params captured by a mount path stay visible to everything beneath it, and `req.baseUrl` reports the path the router was mounted at while `req.url` reports the rest.

### Mounting apps

An entire `single-page-express` app can be mounted on another one, which is how Express sub-apps work:

```javascript
const subApp = require('single-page-express')({ templatingEngine, templates })
subApp.get('/page', function (req, res) { res.render('page', {}) })

app.use('/sub', subApp)

subApp.mountpath // '/sub'
subApp.path()    // '/sub'
```

A mounted app emits a `mount` event with its parent:

```javascript
subApp.on('mount', function (parent) {
  console.log('mounted on', parent)
})
```

### Route params

`app.param()` registers a callback that runs when a given param is present in a matched route, before the route's own handlers. It runs once per request per param:

```javascript
app.param('userId', function (req, res, next, value, name) {
  req.user = lookUpUser(value)
  next()
})

app.get('/users/:userId', function (req, res) {
  res.render('user', { user: req.user })
})
```

Routers have their own `param()` method that works the same way for the routes they hold.

You can also call `app.triggerRoute(params)` to activate the route callback registered for a given route, as though the link was clicked or a form was POSTed. It returns a promise that resolves once the route callback has finished, so you can `await` it.

Params accepted by `app.triggerRoute` include:

- `route`: Which route you're triggering.
- `method`: e.g. GET, POST, etc. (Case insensitive.)
- `body`: What to supply to `req.body` if you're triggering a POST.

### Validating your templates

`single-page-express` can run the markup your templates produce through an HTML validator on every render, which is a quick way to catch unclosed tags, missing `alt` attributes, and similar mistakes that a browser will silently paper over.

The validator is not bundled with `single-page-express`, because most apps do not want a validator shipped to production. Install one yourself, create an instance, and hand it to the constructor. [html-validate](https://html-validate.org/) is what this was built against:

```javascript
const { HtmlValidate } = require('html-validate/browser')

const app = require('single-page-express')({
  templatingEngine,
  templates,
  htmlValidator: new HtmlValidate({ extends: ['html-validate:recommended'] })
})
```

Anything with a `validateStringSync(markup)` or `validateString(markup)` method works, so you can supply your own if you prefer a different validator or want to preprocess the markup first.

Problems are reported to the console, naming the template and the line and column within it:

```
single-page-express: invalid html in the post-rendered template 'index' at line 1, column 16: Element <p> is implicitly closed by parent </div> [no-implicit-close]
```

Validation never blocks or alters a render; it only tells you what is wrong. The full report is also handed to your render hooks as `params.htmlValidation`, so you can do something else with it:

```javascript
const app = require('single-page-express')({
  htmlValidator: new HtmlValidate({ extends: ['html-validate:recommended'] }),
  afterEveryRender: (params) => {
    if (params.htmlValidation && !params.htmlValidation.valid) showMyOwnWarningBanner(params.htmlValidation)
  }
})
```

Since this is a development aid, a common approach is to supply the validator only outside of production, so it is tree-shaken out of your production bundle:

```javascript
htmlValidator: process.env.NODE_ENV === 'production' ? undefined : new HtmlValidate({ extends: ['html-validate:recommended'] })
```

### Targeting Express 4

These docs describe the Express 5 API, which is what `single-page-express` targets by default. If your Express app is still on Express 4, set `expressVersion` to `4` in the constructor so that route strings are parsed by the Express 4 route parser instead:

```javascript
const app = require('single-page-express')({
  expressVersion: 4,
  templatingEngine,
  templates
})
```

Express 3 and below are not supported.

The difference that comes up most often is wildcard syntax. Express 4 accepts a bare `*`, while Express 5 requires the wildcard to be named:

```javascript
// express 4
app.route('*').get(function (req, res) { /* ... */ })

// express 5
app.route('/*all').get(function (req, res) { /* ... */ })
```

If you register a route with Express 4 wildcard syntax while targeting Express 5, `single-page-express` will log an error telling you to rename the wildcard, because the Express 5 route parser rejects the pattern outright.

For the rest of the differences between the two, see the [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html). Everything else described in these docs — middleware, routers, mounting, `app.param()` — works the same way under both.

### Controlling scroll position behavior

By default, `single-page-express` will remember the scroll position of pages that have been visited. It will also remember the scroll position of child containers on each page as well, but only if those containers have assigned `id` attributes.

If you wish to not remember the scroll position on a per route basis, supply `res.resetScroll = true` in your route. To disable this memory app-wide, set the `alwaysScrollTop` param to `true` in the constructor.

### Running the sample apps

There are 4 sample apps you can run to see demos of how `single-page-express` can be used:

1. Basic frontend-only sample app:

   - This is a minimalist demo of `single-page-express` that just demos various kinds of routes working as expected, but does not wire up any templating system or do anything other than log data to the console when the render method is called.
   - To run it:
     - `npm ci`
     - `npm run sample-app-basic-frontend-only`
       - Or `npm run sample1`
     - Go to http://localhost:3000

2. Basic frontend-only sample app with templating:

   - Similar to the above demo, but includes a templating engine and demos page navigation in the single page app context.
   - To run it:
     - `npm ci`
     - `npm run sample-app-basic-frontend-only-with-templating`
       - Or `npm run sample2`
   - Go to [http://localhost:3000](http://localhost:3000)

3. Express-based sample app:

   - This is a full Express app that demos sharing routes and templates on the backend and frontend.
   - To run it:
     - `cd sampleApps/express`
     - `npm ci`
     - `cd ../../`
     - `npm run express-sample`
       - Or `npm run sample3`
       - Or `cd` into `sampleApps/express` and run `npm ci` and `npm start`
   - Go to [http://localhost:3000](http://localhost:3000)

4. More complex Express-based sample app:

   - Similar to the previous one but tests more features of `single-page-express`. This app exists mainly for the automated tests, but you can use it as a template for your app too if you like.
   - To run it:
     - `cd sampleApps/express-complex`
     - `npm ci`
     - `cd ../../`
     - `npm run express-complex`
       - Or `npm run sample4`
       - Or `cd` into `sampleApps/express-complex` and run `npm ci` and `npm start`
   - Go to [http://localhost:3000](http://localhost:3000)
