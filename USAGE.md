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
const app = require('single-page-express')({
  templatingEngine,
  templates
})
```

### Defining routes

The various methods of defining routes [like you would with Express](https://expressjs.com/en/guide/routing.html) are supported.

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

// route with express 4 wildcard syntax
app.route('*').get(function (req, res) {
  res.render('someTemplate', { some: 'model' })
})

// route with express 5 wildcard syntax
app.route('*:all').get(function (req, res) {
  res.render('someTemplate', { some: 'model' })
})

// handle a form submit
app.route('/routeWithFormSubmit').post(function (req, res) {
  console.log('req.body:', req.body)
  res.render('someTemplate', { some: 'model' })
})
```

You can also call `app.triggerRoute(params)` to activate the route callback registered for a given route, as though the link was clicked or a form was POSTed.

Params accepted by `app.triggerRoute` include:

- `route`: Which route you're triggering.
- `method`: e.g. GET, POST, etc. (Case insensitive.)
- `body`: What to supply to `req.body` if you're triggering a POST.

### Controlling scroll position behavior

By default, `single-page-express` will remember the scroll position of pages that have been visited. It will also remember the scroll position of child containers on each page as well, but only if those containers have assigned `id` attributes.

If you wish to not remember the scroll position on a per route basis, supply `res.resetScroll = true` in your route. To disable this memory app-wide, set the `alwaysScrollTop` param to `true` in the constructor.

### Running the sample apps

There are 3 sample apps you can run to see demos of how `single-page-express` can be used:

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
     - `npm run express-express-complex`
       - Or `npm run sample4`
       - Or `cd` into `sampleApps/express-complex` and run `npm ci` and `npm start`
   - Go to [http://localhost:3000](http://localhost:3000)
