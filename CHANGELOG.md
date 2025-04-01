# Changelog

## Next version

- Put your changes here...

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
