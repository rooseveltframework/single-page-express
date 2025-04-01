const app = window.singlePageExpress({
  expressVersion: 5,
  disableTopbar: true,
  templatingEngine: window.teddy,
  templates: { // in a real app, you'd populate the templates object with some kind of module bundler or something
    'layouts/main': `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="format-detection" content="telephone=no">
          <title>Sample app for single-page-express</title>
          <script src="teddy.js" defer></script>
          <script src="single-page-express.js" defer></script>
          <script src="index.js" defer></script>
        </head>
      <body>
        <main>
          <p>Open the browser console to see logs that illustrate how the single page app is handling navigation events.</p>
          <nav>
            <ul>
              <li><a href="/">Homepage</a></li>
              <li><a href="/secondPage">Second page</a></li>
            </ul>
          </nav>
          <article>
            {pageContent|s}
          </article>
        </main>
      </body>
      </html>`,
    index: `<include src="layouts/main">
      <arg pageContent>
        <p>hello world</p>
      </arg>
      </include>`,
    secondPage: `<include src="layouts/main">
      <arg pageContent>
        <p>this is a second page and prints a {variable}</p>
      </arg>
      </include>`
  }
})

// routes
app.route('/').get(function (req, res) {
  console.log('req object:', req)
  res.render('index', {})
})

app.route('/secondPage').get(function (req, res) {
  console.log('req object:', req)
  res.render('secondPage', { variable: 'variable with contents: "hi there!"' })
})

// register the templates with the teddy templating system
Object.entries(app.templates).forEach(([name, template]) => window.teddy.setTemplate(name, template))

// load the default route and render the page
app.triggerRoute({ route: '/' })
