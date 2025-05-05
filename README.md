📄 **single-page-express** [![npm](https://img.shields.io/npm/v/single-page-express.svg)](https://www.npmjs.com/package/single-page-express)

A client-side implementation of the [Express](http://expressjs.com) route API. It works by hijacking links and form submits, then providing a direct imitation of the Express route API to handle "requests" (click or submit events) and issue "responses" in the form of DOM updates.

When a `single-page-express` route is triggered, it will update the browser history state to match the route accordingly, update the scroll position appropriately, set focus appropriately, will start a [view transition](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) to animate the DOM updates, and there are hooks available to customize the animations as well. If view transitions are not supported in the browser, the page will transition, but it will not animate unless you set a custom animation using another animation technique.

This allows you to write isomorphic (aka universal, [amphibious](https://twitter.com/kethinov/status/566896168324825088), etc) router code that can be shared verbatim on the client and the server in your Express application.

When you combine this with a JS-based templating system that can run on the client and server as well, that will enable you to write Express-based single page apps that support both server-side and client-side rendering while maximizing code re-use in both contexts without having to use a big JS framework to accomplish the task instead.

You can also use this module in purely frontend contexts without an Express server behind it (e.g. an Electron app).

This module was built and is maintained by the [Roosevelt web framework](https://rooseveltframework.org) [team](https://rooseveltframework.org/contributors), but it can be used independently of Roosevelt as well.

<details open>
  <summary>Documentation</summary>
  <ul>
    <li><a href="./USAGE.md">Usage</a></li>
    <li><a href="./CONFIGURATION.md">CONFIGURATION</a></li>
  </ul>
</details>

## Why this instead of...

`single-page-express` has several benefits over other popular single page app architecture approaches, such as:

- All routes can very easily be either server-rendered or rendered client-side without duplicating efforts since all the route and template code can be shared with both the server and client.

- Unlike other SPA framework approaches that support server-rendering, this approach yields a very small dependency tree and thus very small frontend bundle sizes. Hello world will be measured in tens of kilobytes, not hundreds, and certainly not megabytes.

- Likewise there is very little complexity to the architecture. If you know how to use Express, then it won't take you long to learn how to use this module on the frontend too.

- Like Express, this module is unopinionated about what templating engine you use for rendering HTML templates. Use any templating engine that supports Express.

- The default render method includes many smart defaults, including easy hooks for setting the page title, updating children of the `<head>` tag, automatic support for announcing template renders as new pages to screen readers, setting browser focus to the correct element, and more. The specifics of the default render method's behavior are detailed below, and you can replace the default render method with your own if you prefer different behavior.

Don't build a SPA (single page app), build a SPE (single page Express) app!
