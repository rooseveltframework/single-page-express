## 2.2.0

- Added `singlePageExpress.htmlValidateConfig`, an [html-validate](https://html-validate.org/) config to hand the `htmlValidator` param. It is `html-validate:recommended` with `attribute-boolean-style` and `attribute-empty-style` turned off, by default.
- Added `topbarDelay`, which is how long a navigation has to still be working before the top bar appears at all, defaulting to 250ms. Set it to `0` for the previous behavior of showing the bar the moment a navigation starts.
- Fixed the top bar vanishing the moment a view transition started and reappearing when it ended.
- Fixed the listener that scrolled the page after a view transition never being removed. Each navigation added another one, so the tenth navigation ran ten of them, each restoring the scroll position of whichever page it had been created for.
- Updated dependencies.

## 2.1.0

- Added support for Express middleware. `app.use()` accepts an optional path followed by any number of middleware functions, arrays of them, routers, or other apps, and error handling middleware is identified by its arity of four, as in Express. Middleware alone will never cause a link or form submit to be captured; only a matching route does that.
- Added support for the Express Router. `singlePageExpress.Router([options])` creates a router that holds its own middleware, routes and param callbacks, and is mounted with `use()` on an app or another router.
- Added support for mounting apps. A `single-page-express` app can be mounted on another one with `app.use()`, which sets `app.mountpath` and `app.parent`, makes `app.path()` report the full mount path, fires the `mount` event, and sets `req.baseUrl` and `req.url` for requests it handles.
- Added support for `app.param()` and `router.param()`.
- Added optional HTML validation of post-rendered templates via the new `htmlValidator` constructor param. Supply an [html-validate](https://html-validate.org/) instance, or anything with a `validateStringSync()` or `validateString()` method, and the markup your templates produce is checked on every render, with problems reported to the console and the full report handed to your render hooks as `params.htmlValidation`.
- Added stubs for the native Node.js `http.IncomingMessage` and `http.ServerResponse` properties and methods that Express's request and response objects inherit, so that a route written against them does not crash when it is reused on the frontend.
- Added support for `req.param()`, `res.locals`, `app.locals`, and the header methods `res.set()`, `res.get()`, `res.append()`, `res.header()`, `res.location()`, `res.type()`, `res.vary()` and `res.status()`, which now record what they are given so a route that sets a header or a status and reads it back gets what it set.
- Added support for changing `case sensitive routing` and `strict routing` after routes have been registered; route patterns are now compiled on demand rather than at registration time.
- Fixed a bug that caused the remembered scroll position of a page to be lost whenever it was returned to with the back or forward button. The browser updates `window.location` before firing `popstate`, so the scroll position being saved for the page being left was written under the key of the page being returned to, overwriting the very position that was about to be restored. Scroll positions are now saved under the route that is actually on screen.
- Fixed a bug that caused a page's scroll position to be remembered separately per query string rather than per path.
- Fixed a bug that caused the back button to fail to restore the page the user started on. The history entry the page loads on has no state of its own, and the popstate handler ignores entries without one, so the first press of the back button changed the URL without re-rendering.
- Fixed a bug that caused `app.all` to register unusable routes, making routes declared with it never fire.
- Fixed a bug that caused the `case sensitive routing` setting to be applied backwards; routes are now matched case insensitively by default and case sensitively when the setting is enabled, as in Express.
- Fixed a bug that caused route params to be lowercased when case insensitive routing was in effect.
- Fixed a bug that caused `req.cookies` to contain a phantom entry when no cookies were set, and to truncate cookie values containing `=`.
- Fixed a bug that caused `req.protocol` to include a trailing colon rather than reporting the protocol the way Express does.
- Fixed a bug that caused `res.appendTargets` to persist across renders instead of being cleared after each one.
- Fixed a bug that caused the default render method to throw instead of logging an error when no templating engine was supplied.
- Fixed a bug that caused the default render method to skip focusing elements it should focus and focus elements declared inert.
- Fixed a bug that caused `app.afterEveryRender`, `res.afterRender`, and the screen reader announcement to fire once per target rather than once per render.
- Fixed a bug that caused a crash when `res.resetScroll` was set on a page that had not been visited before.
- Fixed a bug that caused Express 4 route params to be extracted with a fragile pattern instead of the route parser's own key names.
- Fixed the Teddy example in the usage docs, which never registered its templates with Teddy and so rendered template names instead of templates.
- Fixed the Express 5 wildcard route example in the usage docs, which used a route pattern the route parser rejects.
- Fixed the documented type and description of `res.appendTargets`, which is a boolean flag rather than a list of selectors, and corrected its name where the docs called it `res.addTargets`.
- Updated dependencies.

## 2.0.5

- Added `app.alwaysSkipViewTransition` and `res.skipViewTransition` options. When set to true, if using the default render method, the DOM update will not be wrapped in a `document.startViewTransition()` call, which is useful in improving performance if you're not doing an animation. Default: `false`.
- Fixed a bug that caused some `app.get` calls to fail despite correctly matching the API.
- Updated dependencies.

## 2.0.4

- Fixed a bug that caused a race condition related to view transitions and afterRender methods and render callbacks.
- Fixed a bug that caused Single Page Express to trigger on `<a>` elements that do not have `href` attributes.
- Fixed a bug that caused Single Page Express to trigger on `<form>` elements that do not have `action` attributes.
- Fixed a bug that caused history state to be modified in ways that could cause crashes.
- Updated dependencies.

## 2.0.3

- Fixed regression that caused after-render actions to break in Chrome in the default render method.
- Updated dependencies.

## 2.0.2

- Fixed regression that caused middleware support to break routes without middleware.
- Updated dependencies.

## 2.0.1

- Added support for middleware on routes.
- Updated dependencies.

## 2.0.0

- Breaking: Changed default Express API version to 5.
  - To migrate:
    - Most apps probably only need to change `*` routes to `*all`.
    - Apps that use more complex routing may need other changes.
    - Full list of considerations for migrating to Express 5: https://expressjs.com/en/guide/migrating-5.html
- Fixed a bug that caused `req.body` to populate `{}` instead of `undefined` in Express 5 mode.
- Fixed a bug that caused the default `/` route to not load in some situations.
- Fixed a bug that caused extra `<head>` tags to get inserted into the DOM with the default render method in some situations.
- Fixed issues in sample app 2.
- Updated dependencies.

## 1.2.0

- Added view transition support in the default render method.
- Added support for multiple DOM update targets in the default render method.
- Added `req.backButtonPressed` and `req.forwardButtonPressed` to `app`.
- Added classes `backButtonPressed` and `forwardButtonPressed` which will populate on the `<html>` element if either button was pressed.
- Added `[data-page-title]` to the top of the list of accepted query selectors for sourcing content to announce to screen readers when a new page is rendered.
- Added new params to the `res.beforeRender(params)`, `beforeEveryRender(params)`, `res.afterRender(params)`, and `afterEveryRender(params)` methods:
  - It now supplies an object with:
    - `model`: The data model supplied to the template to be rendered.
    - `doc`: The document object created from the template after it is rendered.
    - `markup`: The HTML string that will be written to the page.
    - `targets`: The list of DOM nodes that will be updated.
- Fixed a bug that caused `postRenderCallbacks` not to function properly.
- Fixed a bug related to script tags from the rendered page being executed unnecessarily.
- Fixed a bug causing unnecessary outlines to appear on page transitions in Safari.
- Updated dependencies.

## 1.1.1

- Fixed crash related to unfinished HTML validation feature.
- Updated dependencies.

## 1.1.0

- Added feature which will allow `single-page-express` to remember the scroll position of pages that have been visited. It will also remember the scroll position of child containers on each page as well, but only if those containers have assigned `id` attributes.
  - Added `alwaysScrollTop` param which will let you disable this behavior app wide and `res.resetScroll` which will let you disable this behavior on a per-route basis.
- Added new behaviors to the default render method. It will now:
  - Update the attributes of the `<html>` and `<head>` tags.
  - Add new children to the `<head>` tag if anything new is in the template render.
  - Delay the DOM update until any new `<link>` or `<script>` tags load to prevent a FOUC.
  - Set browser focus appropriately after the DOM update. Also added `res.focus` to let you set it manually.
  - Announce page changes to screen readers.
- Added `res` properties which will let you remove elements from the `<head>` tag on a per route basis: `res.removeMetaTags`, `res.removeStyleTags`, `res.removeLinkTags`, `res.removeScriptTags`, `res.removeBaseTags`, `res.removeTemplateTags`. There is also `res.removeHeadTags` to remove all children of the `<head>` tag except the `<title>` tag.
- Added `topBarRoutes` param to allow restricting the top bar to certain routes.
- Added `req.singlePageExpress` which you can use to detect if your route is executing in the `single-page-express` context.
- Fixed a bug which caused back/forward buttons to not function properly sometimes.
- Fixed a bug which would cause the top bar not to ever hide if it was enabled but the default render method was replaced.
- Fixed a bug in the Express sample app that would cause server-rendering to fail on routes with more than one `/`.
- Added a new sample app.
- Added an automated test suite and a few starter tests.
- Refactored some code to simplify it.
- Removed some unneeded dependencies.
- Updated dependencies.

## 1.0.3

- Fixed missing exports so you can require/import Single Page Express less verbosely in your projects.
- Updated docs to clarify what the different builds of Single Page Express are meant to be used for.
- Updated dependencies.

## 1.0.2

- Fixed bug causing custom `res` variables to not be set properly during certain default render method calls.
- Fixed broken Express 5 support.
- Updated dependencies.

## 1.0.1

- Fixed broken postinstall script.

## 1.0.0

- Initial version.
