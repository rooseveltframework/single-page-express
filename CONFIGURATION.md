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

- `expressVersion` *[Number]*: Optionally set which version of the Express API to use for route string parsing. Supports values `4` or `5`. Express 3 and below are not supported. Defaults to `5`.
- `templatingEngine` *[String]*: Which Express templating system to use. You must include the package in your app and supply the module as an argument to this param. This param is required if you use the default render method and do not supply your own.
- `templates` *[Object]*: Supply an object with keys that are template names and values that are template strings. This param is required if you use the default render method and do not supply your own.
- `renderMethod(template, model callback)` *[Function]*: Optionally supply a function to execute when `res.render` is called in your routes. If you do not provide one, a default one will be used that will render your template with your chosen templating engine and make appropriate updates to the DOM. See below for details about what the default render method does specifically and how to customize its behavior.
- `disableTopbar` *[Boolean]*: Disable the [top bar](https://buunguyen.github.io/topbar/) loading bar. Default: `false` (the loading bar is enabled by default)
- `topbarConfig` *[Object]*: Options to supply to [top bar](https://buunguyen.github.io/topbar/) to customize its aesthetics and behavior. See the site's documentation for a list of options.
- `topBarRoutes` *[Array of Strings]*: Which routes to use [top bar](https://buunguyen.github.io/topbar/) on. Defaults to all if this option is not supplied.
- `alwaysScrollTop` *[Boolean]*: Always scroll to the top of the page after every render. Default: `false` (the default render method will remember the scroll position of each page visited and restore that scroll position when you revisit those pages)

#### Customizing the default render method's behavior

These constructor params are only relevant if you're not supplying a custom render method.

##### Pre-render

- `beforeEveryRender(params)` *[Function]*: Optionally supply a function to execute just before your template is rendered and written to the DOM. Useful for beginning a CSS transition.
  - You can also set `res.beforeRender(params)` *[Function]* on a per request basis.
  - The `params` argument contains:
    - `model` *[Object]*: The data model supplied to the template to be rendered.
    - `doc` *[String]*: The document object created from the template after it is rendered.
    - `markup` *[String]*: The HTML string that will be written to the page.
    - `targets` *[Array of Strings]*: The list of DOM nodes that will be updated.
- `defaultTarget` *[String]*: Query string representing the default element to target if one is not supplied by `res.target`. Defaults to the `<body>` tag if neither `res.target` or `app.defaultTarget` is supplied.
- `defaultTargets` *[Array of Strings]*: Array of query strings representing elements to target for replacement if such an array is not supplied by `res.target`. Elements found matching the query strings in the array will be replaced with the corresponding query string from the rendered template.
- `updateDelay` *[Number]*: How long to wait in milliseconds between rendering the template and writing its contents to the DOM. This is useful to give your animations time to animate if you're using animations. Default: `0`.
  - You can also set `res.updateDelay` on a per request basis.

##### Post-render

- `afterEveryRender(params)` *[Function]*: Optionally supply a function to execute just after your template is rendered and written to the DOM. Useful for finishing a CSS transition.
  - You can also set `res.afterRender(params)` *[Function]* on a per request basis.
  - The `params` argument contains:
    - `model` *[Object]*: The data model supplied to the template rendered.
    - `doc` *[String]*: The document object created from the template after it was rendered.
    - `markup` *[String]*: The HTML string that was written to the page.
    - `targets` *[Array of Strings]*: The list of DOM nodes that were updated.
- `postRenderCallbacks` *[Object]*: Optionally supply an object with keys that are template names and values that are functions to execute after that template renders. You can also supply `*` as a key to execute a post-render callback after every template render.

### Application object

When you call the constructor, it will return an `app` object.

#### Properties

- `afterEveryRender(params)` *[Function]*: Function to execute after every template render sourced from the constructor params.
- `alwaysScrollTop` *[Boolean]*: If true, the app will not remember scroll position on a per-page basis.
- `appVars` *[Object]*: List of variables stored via `app.set()` and retrieved with `app.get()`.
- `beforeEveryRender(params)` *[Function]*: Function to execute before every template render sourced from the constructor params.
- `defaultTarget` *[String]*: Query string representing the default element to target if one is not supplied by `res.target`.
- `defaultTargets` *[Array of Strings]*: Optional array of query strings representing elements to target for replacement if such an array is not supplied by `res.target`.
- `expressVersion` *[Number]*: Which version of the Express API to use for route string parsing sourced from the constructor params.
- `postRenderCallbacks` *[Object]*: List of callback functions to execute after a render event occurs sourced from the constructor params.
- `routes` *[Object]*: List of routes registered with `single-page-express`.
- `routeCallbacks` *[Object]*: List of callback functions executed when a given route is visited.
- `templates` *[Object]*: List of templates loaded into into `single-page-express` sourced from the constructor params.
- `templatingEngine` *[String]*: The templating engine module loaded into `single-page-express` sourced from the constructor params.
- `topbarEnabled` *[Boolean]*: Whether or not the top loading bar is enabled.
- `topbarRoutes` *[Array of Strings]*: Which routes to use the top loading bar on; defaults to all if this option is not supplied.
- `updateDelay` *[Number]*: How long to wait before rendering a template sourced from constructor params.
- `urls` *[Object]*: List of URLs that have been visited and metadata about them.

## Express API implementation

`single-page-express` is a *partial* frontend implementation of the [Express API](https://expressjs.com/en/api.html). Below is a full list of Express API methods and the degree to which it is implemented.

### App constructor methods

**Not supported**: None from Express are implemented. `single-page-express` implements its own constructor which is described above.

### Application object

#### Settings

- `case sensitive routing` *[Boolean]*: Supported. Defaults to `false`.
- `env` *[String]*: Supported. Defaults to `production`.
- `etag`: **Not supported** because there is no request cycle concept in single page app contexts.
- `jsonp callback name`: **Not supported** because it is not useful in single page app contexts.
- `json escape`:  **Not supported** because it is not useful in single page app contexts.
- `json replacer`:  **Not supported** because it is not useful in single page app contexts.
- `json spaces`:  **Not supported** because it is not useful in single page app contexts.
- `query parser` *[Boolean]*: Partially supported. In Express there are multiple options, but in `single-page-express` you can set it to either `true` or `false`. It defaults to `true`.
- `strict routing` *[Boolean]*: Supported. Defaults to `false`.
- `subdomain offset` *[Number]*: Supported. Defaults to `2`.
- `trust proxy`: **Not supported** because there is no request cycle concept in single page app contexts.
- `views`: **Not supported** because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `view cache`: **Not supported** because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `view engine`: **Not supported** because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `x-powered-by`: **Not supported** because there is no request cycle concept in single page app contexts.

#### Properties

- `app.locals` *[Object]*: **Stubbed out**. This will always return `{}` because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `app.mountpath` *[String]*: **Stubbed out**. This will always return `''` because `single-page-express` does not have a concept of app mounting in the way that Express does. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/4).

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
    - `route` *[String]*: Which route you're triggering.
    - `method` *[String]*: e.g. GET, POST, etc. (Case insensitive.)
    - `body` *[Object]*: What to supply to `req.body` if you're triggering a POST.

### Request object

#### Properties

- `req.app` *[Object]*: Supported, however the app object returned will not have all the same properties and methods as Express itself due to the API differences documented above.
- `req.baseUrl` *[String]*: **Stubbed out**. This will always be `''` because `single-page-express` does not have a concept of app mounting in the way that Express does. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/4).
- `req.body` *[Object]*: Supported.
- `req.cookies` *[Object]*: Supported.
- `req.fresh` *[Boolean]*: **Stubbed out**. This will always be `true` because there is no request cycle concept in single page app contexts.
- `req.hostname` *[String]*: Supported.
- `req.ip` *[String]*: **Stubbed out**. This will always be `127.0.0.1` because there is no request cycle concept in single page app contexts.
- `req.ips` *[Array of Strings]*: **Stubbed out**. This will always be `[]` because there is no request cycle concept in single page app contexts.
- `req.method` *[String]*: Supported.
- `req.originalUrl` *[String]*: Supported.
- `req.params` *[Object]*: Supported.
- `req.path` *[String]*: Supported.
- `req.protocol` *[String]*: Supported.
- `req.query` *[String]*: Supported.
- `req.res` *[Object]*: Supported.
- `req.route` *[String]*: Supported.
- `req.secure` *[Boolean]*: Supported.
- `req.signedCookies` *[Object]*: **Stubbed out**. This will always be `{}` because there is no request cycle concept in single page app contexts.
- `req.stale` *[Boolean]*: **Stubbed out**. This will always be `false` because there is no request cycle concept in single page app contexts.
- `req.subdomains` *[Array of Strings]*: Supported.
- `req.xhr` *[Boolean]*: **Stubbed out**. This will always be `true` because there is no request cycle concept in single page app contexts.
- Other `req` properties [from the Node.js API](https://nodejs.org/api/http.html#class-httpserverresponse): **Not supported**. They are uncommonly used in Express applications, so they are not even stubbed out. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/6).

#### Methods

All Express request object methods are **stubbed out** but do nothing because because there is no request cycle concept in single page app contexts and all of the Request methods in Express pertain to the HTTP traffic flowing back and forth between the server and client.

Likewise all other `req` methods [from the Node.js API](https://nodejs.org/api/http.html#class-httpserverresponse) are **not supported**. They are uncommonly used in Express applications, so they are not even stubbed out. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/6).

#### New properties defined by single-page-express

- `req.backButtonPressed` *[Boolean]*: This will be `true` when the browser back button was pressed. A class `backButtonPressed` will also be added to the `<html>` element.
- `req.forwardButtonPressed` *[Boolean]*: This will be `true` when the browser forward button was pressed. A class `forwardButtonPressed` will also be added to the `<html>` element.
- `req.singlePageExpress` *[Boolean]*: This property will always be set to `true`. You can use it to detect whether your route is executing in the `single-page-express` context or not.

### Response object

#### Properties

- `res.app` *[Object]*: Supported, however the app object returned will not have all the same properties and methods as Express itself due to the API differences documented above.
- `res.headersSent` *[Boolean]*: **Stubbed out**. This will always be `false` because there is no request cycle concept in single page app contexts.
- `res.locals` *[Object]*: **Stubbed out**: This will always return `{}` because there is no concept of a "view engine" in `single-page-express`. Instead, you supply a templating system to `single-page-express`'s constructor if you're using the default render method or author your own render method and wire up templating systems yourself.
- `res.req` *[Object]*: Supported.
- Other `res` properties [from the Node.js API](https://nodejs.org/api/http.html#class-httpserverresponse): **Not supported**. They are uncommonly used in Express applications, so they are not even stubbed out. See [feature request](https://github.com/rooseveltframework/single-page-express/issues/6).

##### New properties defined by single-page-express

- `res.addTargets` *[Array of Strings]*: If using the default render method, use this variable to set an array of query selectors representing elements to target for replacement in addition to whatever is set by `app.defaultTargets`. Elements found matching the query strings in the array will be replaced with the corresponding query string from the rendered template.
- `res.afterRender(params)` *[Function]*: If using the default render method, you can set this to a function that will execute after every render.
- `res.beforeRender(params)` *[Function]*: If using the default render method, you can set this to a function that will execute before every render.
- `res.focus` *[String]*: If using the default render method, if you set `res.focus`, the browser's focus will be set to that element after the page is rendered. If you do not set `res.focus`, then the browser's focus will be set to the first non-inert element in the DOM with the `autofocus` attribute, or, if none are present, it will be set to whatever the target element was set to for the DOM update.
- `res.removeBaseTags` *[Boolean]*: If using the default render method, this will remove any `<base>` tags from the page before doing the DOM update.
- `res.removeHeadTags` *[Boolean]*: If using the default render method, this will remove all children of the `<head>` tag except the title element from the page before doing the DOM update.
- `res.removeLinkTags` *[Boolean]*: If using the default render method, this will remove any `<link>` tags from the page before doing the DOM update.
- `res.removeMetaTags` *[Boolean]*: If using the default render method, this will remove any `<meta>` tags from the page before doing the DOM update.
- `res.removeScriptTags` *[Boolean]*: If using the default render method, this will remove any `<script>` tags from the page before doing the DOM update.
- `res.removeStyleTags` *[Boolean]*: If using the default render method, this will remove any `<style>` tags from the page before doing the DOM update.
- `res.removeTemplateTags` *[Boolean]*: If using the default render method, this will remove any `<template>` tags from the page before doing the DOM update.
- `res.target` *[String or Array of Strings]*: If using the default render method, use this variable to set a query selector or array of query selectors to determine which DOM node contents will be replaced by your template render's contents. If none is supplied, and neither `app.defaultTarget` nor `app.defaultTargets` is set, then the contents of the `<body>` tag will be replaced with the output of your rendered template.
- `res.title` *[String]*: If using the default render method, use this variable to set a page title for the new render.
- `res.updateDelay` *[Number]*: If using the default render method, use this variable to set a delay in milliseconds before the render occurs. If not using the default render method, this property will still allow you to specify a delay before resetting the scroll position.
- `res.resetScroll` *[Boolean]*: Purges the memory of the scroll position for this route so that scroll position is reset to the top for this page and all its child containers.

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
