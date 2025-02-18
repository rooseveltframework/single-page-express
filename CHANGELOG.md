# Changelog

## Next version

- Put your changes here...

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
