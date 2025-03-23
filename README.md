# single-page-express

[![Build Status](https://github.com/rooseveltframework/single-page-express/workflows/CI/badge.svg
)](https://github.com/rooseveltframework/single-page-express/actions?query=workflow%3ACI) [![npm](https://img.shields.io/npm/v/single-page-express.svg)](https://www.npmjs.com/package/single-page-express)

A client-side implementation of the [Express](http://expressjs.com) route API. It works by hijacking links and form submits, then providing a direct imitation of the Express route API to handle "requests" (click or submit events) and issue "responses" in the form of DOM updates.

When a `single-page-express` route is triggered, it will update the browser history state to match the route accordingly, update the scroll position appropriately, set focus appropriately, will start a [view transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) to animate the DOM updates, and there are hooks available to customize the animations as well. If view transitions are not supported in the browser, the page will transition, but it will not animate unless you set a custom animation using another animation technique.

This allows you to write isomorphic (aka universal, [amphibious](https://twitter.com/kethinov/status/566896168324825088), etc) router code that can be shared verbatim on the client and the server in your Express application.

When you combine this with a JS-based templating system that can run on the client and server as well, that will enable you to write Express-based single page apps that support both server-side and client-side rendering while maximizing code re-use in both contexts without having to use a big JS framework to accomplish the task instead.

You can also use this module in purely frontend contexts without an Express server behind it (e.g. an Electron app).

This module was built and is maintained by the [Roosevelt web framework](https://github.com/rooseveltframework/roosevelt) [team](https://github.com/orgs/rooseveltframework/people), but it can be used independently of Roosevelt as well.

## Why this instead of...

`single-page-express` has several benefits over other popular single page app architecture approaches, such as:

- All routes can very easily be either server-rendered or rendered client-side without duplicating efforts since all the route and template code can be shared with both the server and client.

- Unlike other SPA framework approaches that support server-rendering, this approach yields a very small dependency tree and thus very small frontend bundle sizes. Hello world will be measured in tens of kilobytes, not hundreds, and certainly not megabytes.

- Likewise there is very little complexity to the architecture. If you know how to use Express, then it won't take you long to learn how to use this module on the frontend too.

- Like Express, this module is unopinionated about what templating engine you use for rendering HTML templates. Use any templating engine that supports Express.

- The default render method includes many smart defaults, including easy hooks for setting the page title, updating children of the `<head>` tag, automatic support for announcing template renders as new pages to screen readers, setting browser focus to the correct element, and more. The specifics of the default render method's behavior are detailed below, and you can replace the default render method with your own if you prefer different behavior.

Don't build a SPA (single page app), build a SPE (single page Express) app!

## Usage

### Loading single-page-express into your app

First, install `single-page-express` from npm.

The package is distributed with the following builds available:

- `dist/single-page-express.cjs`: CommonJS bundle: `const singlePageExpress = require('single-page-express')`
- `dist/single-page-express.js`: Standalone bundle that can be included via `<script>` tags. Declares a global variable: `singlePageExpress`
- `dist/single-page-express.min.js`: Minified standalone bundle that can be included via `<script>` tags. Declares a global variable: `singlePageExpress`
- `dist/single-page-express.mjs`: ES module: `import singlePageExpress from 'single-page-express'`
- `dist/single-page-express.min.mjs`: Minified ES module: `import singlePageExpress from 'single-page-express/min'`

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

## API

### Default render method behavior

The default render method will handle both full page renders as well as rendering partials:

- If you set `res.title`, the page's title will be updated with its contents. Alternatively, if the template render output contains a `<title>` tag, the page's title will be updated with its contents.
  - When the new page is rendered, it will be announced to screen readers. The content to read to screen readers will be sourced from one of the following querySelectors: `[data-page-title]`, `h1[aria-label]`, `h1`, or `title` in that order.
- If the template render contains an `<html>` or `<head>` tag and there are new attributes on the `<html>` or `<head>` tags that aren't present in the current document, those attributes will be set on the current document. This behavior is additive or replacement-level only. Attributes cannot be removed simply by omitting them in the template render. If you want to remove an attribute, do it with JavaScript, or set it to a different value in your template render.
- If there are any new children for the `<head>` in the template render, they will be inserted into the current document's `<head>` tag if they are not present already.
  - If any of the new tags are `<link>` or `<script>` tags, the DOM update will be delayed until those external files load to prevent a [flash of unstyled content](https://en.wikipedia.org/wiki/Flash_of_unstyled_content).
  - If you set `res.removeMetaTags`, all `<meta>` tags will be removed from the `<head>` before adding any new ones.
  - If you set `res.removeStyleTags`, all `<style>` tags will be removed from the `<head>` before adding any new ones.
  - If you set `res.removeLinkTags`, all `<link>` tags will be removed from the `<head>` before adding any new ones.
  - If you set `res.removeScriptTags`, all `<script>` tags will be removed from the `<head>` before adding any new ones.
  - If you set `res.removeBaseTags`, all `<base>` tags will be removed from the `<head>` before adding any new ones.
  - If you set `res.removeTemplateTags`, all `<template>` tags will be removed from the `<head>` before adding any new ones.
  - If you set `res.removeHeadTags`, all tags except `<title>` will be removed from the `<head>` before adding any new ones.
- If you set `res.target`, the DOM will be updated at that spot. `res.target` is a query selector, so an example value you could give it would be `#my-container`. That would replace the contents of the element with the id "my-container" with the output of your rendered template.
  - If the output of your rendered template also has an element matching the same query selector, then the contents of that portion of the output will be all that is used to replace the target.
  - If you do not set `res.target` and neither `app.defaultTarget` nor `app.defaultTargets` is set, then the contents of the `<body>` tag will be replaced with the output of your rendered template.
  - You can also supply an array of query selectors to `res.target`. Elements found matching the query selectors in the array will be replaced with the corresponding query selectors from the rendered template.
  - If you set `res.appendTargets = true`, any new target(s) you add will be in addition to whatever is set by `app.defaultTarget` or `app.defaultTargets`.
- If you set `res.focus`, the browser's focus will be set to that element after the page is rendered. If you do not set `res.focus`, then the browser's focus will be set to the first non-inert element in the DOM with the `autofocus` attribute, or, if none are present, it will be set to whatever the target element was set to for the DOM update. If there are multiple targets, the first target on the list will be what is selected.
- There are also hooks for setting animations as well. See "Hooks for setting animations" below.

If this DOM manipulation behavior is undesirable to you, you can supply your own render method instead and do whatever you like. To supply your own render method, see the constructor parameter documentation below.

### Constructor parameters

#### Basic configuration

- `expressVersion`: Optionally set which version of the Express API to use for route string parsing. Supports values `4` or `5`. Express 3 and below are not supported. Defaults to `4`.
- `templatingEngine`: Which Express templating system to use. You must include the package in your app and supply the module as an argument to this param. This param is required if you use the default render method and do not supply your own.
- `templates`: Supply an object with keys that are template names and values that are template strings. This param is required if you use the default render method and do not supply your own.
- `renderMethod(template, model callback)`: Optionally supply a function to execute when `res.render` is called in your routes. If you do not provide one, a default one will be used that will render your template with your chosen templating engine and make appropriate updates to the DOM. See below for details about what the default render method does specifically and how to customize its behavior.
- `disableTopbar`: Disable the [top bar](https://buunguyen.github.io/topbar/) loading bar. Default: `false` (the loading bar is enabled by default)
- `topbarConfig`: Options to supply to [top bar](https://buunguyen.github.io/topbar/) to customize its aesthetics and behavior. See the site's documentation for a list of options.
- `topBarRoutes`: Which routes to use [top bar](https://buunguyen.github.io/topbar/) on. Defaults to all if this option is not supplied.
- `alwaysScrollTop`: Always scroll to the top of the page after every render. Default: `false` (the default render method will remember the scroll position of each page visited and restore that scroll position when you revisit those pages)

#### Customizing the default render method's behavior

These constructor params are only relevant if you're not supplying a custom render method.

##### Pre-render

- `beforeEveryRender(params)`: Optionally supply a function to execute just before your template is rendered and written to the DOM. Useful for beginning a CSS transition.
  - You can also set `res.beforeRender(params)` on a per request basis.
  - The `params` argument contains:
    - `model`: The data model supplied to the template to be rendered.
    - `doc`: The document object created from the template after it is rendered.
    - `markup`: The HTML string that will be written to the page.
    - `targets`: The list of DOM nodes that will be updated.
- `defaultTarget`: Query string representing the default element to target if one is not supplied by `res.target`. Defaults to the `<body>` tag if neither `res.target` or `app.defaultTarget` is supplied.
- `defaultTargets`: Array of query strings representing elements to target for replacement if such an array is not supplied by `res.target`. Elements found matching the query strings in the array will be replaced with the corresponding query string from the rendered template.
- `updateDelay`: How long to wait in milliseconds between rendering the template and writing its contents to the DOM. This is useful to give your animations time to animate if you're using animations. Default: `0`
  - You can also set `res.updateDelay` on a per request basis.

##### Post-render

- `afterEveryRender(params)`: Optionally supply a function to execute just after your template is rendered and written to the DOM. Useful for finishing a CSS transition.
  - You can also set `res.afterRender(params)` on a per request basis.
  - The `params` argument contains:
    - `model`: The data model supplied to the template rendered.
    - `doc`: The document object created from the template after it was rendered.
    - `markup`: The HTML string that was written to the page.
    - `targets`: The list of DOM nodes that were updated.
- `postRenderCallbacks`: Optionally supply an object with keys that are template names and values that are functions to execute after that template renders. You can also supply `*` as a key to execute a post-render callback after every template render.

### Application object

When you call the constructor, it will return an `app` object.

#### Properties

- `afterEveryRender`: Function to execute after every template render sourced from the constructor params.
- `alwaysScrollTop`: If true, the app will not remember scroll position on a per-page basis.
- `appVars`: List of variables stored via `app.set()` and retrieved with `app.get()`.
- `beforeEveryRender`: Function to execute before every template render sourced from the constructor params.
- `defaultTarget`: Query string representing the default element to target if one is not supplied by `res.target`.
- `defaultTargets`: Optional array of query strings representing elements to target for replacement if such an array is not supplied by `res.target`.
- `expressVersion`: Which version of the Express API to use for route string parsing sourced from the constructor params.
- `postRenderCallbacks`: List of callback functions to execute after a render event occurs sourced from the constructor params.
- `routes`: List of routes registered with `single-page-express`.
- `routeCallbacks`: List of callback functions executed when a given route is visited.
- `templates`: List of templates loaded into into `single-page-express` sourced from the constructor params.
- `templatingEngine`: The templating engine module loaded into `single-page-express` sourced from the constructor params.
- `topbarEnabled`: Whether or not the top loading bar is enabled.
- `topbarRoutes`: Which routes to use the top loading bar on; defaults to all if this option is not supplied.
- `updateDelay`: How long to wait before rendering a template sourced from constructor params.
- `urls`: List of URLs that have been visited and metadata about them.

## Express API implementation

`single-page-express` is a *partial* frontend implementation of the [Express API](https://expressjs.com/en/api.html). Below is a full list of Express API methods and the degree to which it is implemented.

### App constructor methods

**Not supported**: None from Express are implemented. `single-page-express` implements its own constructor which is described above.

### Application object

#### Settings

- `case sensitive routing`: Supported. Defaults to `false`.
- `env`: Supported. Defaults to `production`.
- `etag`: **Not supported** because there is no request cycle concept in single page app contexts.
- `jsonp callback name`: **Not supported** because it is not useful in single page app contexts.
- `json escape`:  **Not supported** because it is not useful in single page app contexts.
- `json replacer`:  **Not supported** because it is not useful in single page app contexts.
- `json spaces`:  **Not supported** because it is not useful in single page app contexts.
- `query parser`: Partially supported. In Express there are multiple options, but in `single-page-express` you can set it to either `true` or `false`. It defaults to `true`.
- `strict routing`: Supported. Defaults to `false`.
- `subdomain offset`: Supported. Defaults to `2`.
- `trust proxy`: **Not supported** because there is no request cycle concept in single page app contexts.
- `views`: **Not supported** because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `view cache`: **Not supported** because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `view engine`: **Not supported** because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `x-powered-by`: **Not supported** because there is no request cycle concept in single page app contexts.

#### Properties

- `app.locals`: **Stubbed out**. This will always return `{}` because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `app.mountpath`: **Stubbed out**. This will always return `''` because `single-page-express` does not have a concept of app mounting in the way that Express does. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/4).

#### Events

- `mount`: **Stubbed out** but does nothing  because `single-page-express` does not have a concept of app mounting in the way that Express does. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/4).

#### Methods

- `app.all()`: Supported.
- `app.delete()`: Supported.
- `app.disable()`: Supported.
- `app.disabled()`: Supported.
- `app.enable()`: Supported.
- `app.enabled()`: Supported.
- `app.engine()`: **Stubbed out** but does nothing because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `app.get()`: Supported. (Both versions.)
- `app.listen()`: **Stubbed out** but does nothing because there is no "server" concept in single page app contexts.
- `app.METHOD()`: Supported.
- `app.param()`: **Stubbed out** but does nothing because this feature has not been implemented yet. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/1).
- `app.path()`: **Stubbed out** but does nothing because `single-page-express` does not have a concept of app mounting in the way that Express does. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/4).
- `app.post()`: Supported.
- `app.put()`: Supported.
- `app.render()`: Supported.
- `app.route()`: Supported.
- `app.set()`: Supported.
- `app.use()`: **Stubbed out** but does nothing because `single-page-express` does not have a concept of app middleware in the way that Express does. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/2).

##### New methods defined by single-page-express

- `app.triggerRoute(params)`: This will activate the route callback registered for a given route, as though a link was clicked or a form was POSTed.
  - Params accepted by `app.triggerRoute` include:
    - `route`: Which route you're triggering.
    - `method`: e.g. GET, POST, etc. (Case insensitive.)
    - `body`: What to supply to `req.body` if you're triggering a POST.

### Request object

#### Properties

- `req.app`: Supported, however the app object returned will not have all the same properties and methods as Express itself due to the API differences documented above.
- `req.baseUrl`: **Stubbed out**. This will always be `''` because `single-page-express` does not have a concept of app mounting in the way that Express does. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/4).
- `req.body`: Supported.
- `req.cookies`: Supported.
- `req.fresh`: **Stubbed out**. This will always be `true` because there is no request cycle concept in single page app contexts.
- `req.hostname`: Supported.
- `req.ip`: **Stubbed out**. This will always be `127.0.0.1` because there is no request cycle concept in single page app contexts.
- `req.ips`: **Stubbed out**. This will always be `[]` because there is no request cycle concept in single page app contexts.
- `req.method`: Supported.
- `req.originalUrl`: Supported.
- `req.params`: Supported.
- `req.path`: Supported.
- `req.protocol`: Supported.
- `req.query`: Supported.
- `req.res`: Supported.
- `req.route`: Supported.
- `req.secure`: Supported.
- `req.signedCookies`: **Stubbed out**. This will always be `{}` because there is no request cycle concept in single page app contexts.
- `req.stale`: **Stubbed out**. This will always be `false` because there is no request cycle concept in single page app contexts.
- `req.subdomains`: Supported.
- `req.xhr`: **Stubbed out**. This will always be `true` because there is no request cycle concept in single page app contexts.
- Other `req` properties [from the Node.js API](https://nodejs.org/api/http.html#class-httpserverresponse): **Not supported**. They are uncommonly used in Express applications, so they are not even stubbed out. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/6).

#### Methods

All Express request object methods are **stubbed out** but do nothing because because there is no request cycle concept in single page app contexts and all of the Request methods in Express pertain to the HTTP traffic flowing back and forth between the server and client.

Likewise all other `req` methods [from the Node.js API](https://nodejs.org/api/http.html#class-httpserverresponse) are **not supported**. They are uncommonly used in Express applications, so they are not even stubbed out. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/6).

#### New properties defined by single-page-express

- `req.backButtonPressed`: This will be `true` when the browser back button was pressed. A class `backButtonPressed` will also be added to the `<html>` element.
- `req.forwardButtonPressed`: This will be `true` when the browser forward button was pressed. A class `forwardButtonPressed` will also be added to the `<html>` element.
- `req.singlePageExpress`: This property will always be set to `true`. You can use it to detect whether your route is executing in the `single-page-express` context or not.

### Response object

#### Properties

- `res.app`: Supported, however the app object returned will not have all the same properties and methods as Express itself due to the API differences documented above.
- `res.headersSent`: **Stubbed out**. This will always be `false` because there is no request cycle concept in single page app contexts.
- `res.locals`: **Stubbed out**: This will always return `{}` because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `res.req`: Supported.
- Other `res` properties [from the Node.js API](https://nodejs.org/api/http.html#class-httpserverresponse): **Not supported**. They are uncommonly used in Express applications, so they are not even stubbed out. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/6).

##### New properties defined by single-page-express

- `res.addTargets`: If using the default render method, use this variable to set an array of query selectors representing elements to target for replacement in addition to whatever is set by `app.defaultTargets`. Elements found matching the query strings in the array will be replaced with the corresponding query string from the rendered template.
- `res.afterRender(params)`: If using the default render method, you can set this to a function that will execute after every render.
- `res.beforeRender(params)` If using the default render method, you can set this to a function that will execute before every render.
- `res.focus`: If using the default render method, if you set `res.focus`, the browser's focus will be set to that element after the page is rendered. If you do not set `res.focus`, then the browser's focus will be set to the first non-inert element in the DOM with the `autofocus` attribute, or, if none are present, it will be set to whatever the target element was set to for the DOM update.
- `res.removeBaseTags`: If using the default render method, this will remove any `<base>` tags from the page before doing the DOM update.
- `res.removeHeadTags`: If using the default render method, this will remove all children of the `<head>` tag except the title element from the page before doing the DOM update.
- `res.removeLinkTags`: If using the default render method, this will remove any `<link>` tags from the page before doing the DOM update.
- `res.removeMetaTags`: If using the default render method, this will remove any `<meta>` tags from the page before doing the DOM update.
- `res.removeScriptTags`: If using the default render method, this will remove any `<script>` tags from the page before doing the DOM update.
- `res.removeStyleTags`: If using the default render method, this will remove any `<style>` tags from the page before doing the DOM update.
- `res.removeTemplateTags`: If using the default render method, this will remove any `<template>` tags from the page before doing the DOM update.
- `res.target`: If using the default render method, use this variable to set a query selector or array of query selectors to determine which DOM node contents will be replaced by your template render's contents. If none is supplied, and neither `app.defaultTarget` nor `app.defaultTargets` is set, then the contents of the `<body>` tag will be replaced with the output of your rendered template.
- `res.title`: If using the default render method, use this variable to set a page title for the new render.
- `res.updateDelay`: If using the default render method, use this variable to set a delay in milliseconds before the render occurs. If not using the default render method, this property will still allow you to specify a delay before resetting the scroll position.
- `res.resetScroll`: Purges the memory of the scroll position for this route so that scroll position is reset to the top for this page and all its child containers.

#### Methods

- `res.append()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.attachment()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.cookie()`: Supported.
- `res.clearCookie()`: Supported.
- `res.download()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.end()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.format()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.get()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.json()`: Supported, but behaves differently than Express. This method will log the JSON data to the console.
- `res.jsonp()`: **Stubbed out** but does nothing because it is not useful in single page app contexts.
- `res.links()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.location()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.redirect()`: Supported.
- `res.render()`: Supported.
- `res.send()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.sendFile()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.sendStatus()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.set()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.status()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.type()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- `res.vary()`: **Stubbed out** but does nothing because there is no request cycle concept in single page app contexts.
- Other `res` methods [from the Node.js API](https://nodejs.org/api/http.html#class-httpserverresponse): **Not supported**. They are uncommonly used in Express applications, so they are not even stubbed out. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/6).

### Router object

**Not supported**: See [feature request](https://github.com/rooseveltframework/single-page-express/issues/3).
