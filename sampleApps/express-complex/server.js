require('module-alias/register')
const fs = require('fs')
const path = require('path')
const express = require('express')
const app = express()

// configure express
app.use(require('body-parser').urlencoded({ extended: true })) // populates req.body on requests
app.engine('html', require('teddy').__express) // set teddy as view engine that will load html files
app.set('views', 'mvc/views') // set template dir
app.set('view engine', 'html') // set teddy as default view engine
if (!fs.existsSync('public')) fs.mkdirSync('public') // make the public folder if it does not exist
app.use(express.static('public')) // make public folder serve static files
fs.copyFileSync('styles.css', 'public/styles.css')

// load shared express routes; this same file will be loaded in the frontend js bundle
require('./mvc/routes')(app)

// these routes are exclusive to the express server
app.post('/api/randomNumber', async (req, res) => {
  const model = await require('models/getRandomNumber')()
  await new Promise(resolve => setTimeout(resolve, 1000)) // slow it down by a few seconds to simulate network lag
  res.json(model)
})

// package up the templates into a templates.js file
const fileList = fs.readdirSync('mvc/views', { recursive: true })
const templates = {}
for (const file of fileList) {
  const templateCode = fs.readFileSync(path.join('mvc/views/', file), 'utf-8')
  templates[file.slice(0, -5)] = templateCode // key is the file name with no file extension
}
fs.writeFileSync('public/templates.js', `module.exports = ${JSON.stringify(templates)}`)

// write extra files for testing certain routes
fs.writeFileSync('public/extra.css', 'body { }')
fs.writeFileSync('public/extra.js', 'console.log(\'extra script loaded!\')')

// bundle frontend js
const webpack = require('webpack')
const webpackConfig = {
  mode: 'production',
  entry: './browser.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'public'),
    libraryTarget: 'umd'
  },
  resolve: {
    alias: {
      models: path.resolve(__dirname, 'mvc/models/browser')
    }
  },
  devtool: 'source-map'
}
const compiler = webpack(webpackConfig)
compiler.run((err, stats) => {
  if (err || stats.hasErrors()) {
    console.error('Webpack build failed:', err || stats.toJson().errors)
  } else {
    // start express server
    const port = 3000
    app.listen(port, () => {
      console.log(`🎧 single-page-express express sample app server is running on http://localhost:${port}`)
    })
  }
})
