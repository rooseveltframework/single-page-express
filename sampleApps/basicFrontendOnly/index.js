const app = window.singlePageExpress({
  expressVersion: 5
})

// define routes
// using the app.METHOD syntax
app.get('/', function (req, res) {
  console.log('req object:', req)
  console.log('req.route:', req.route)
  res.render('someTemplate', { some: 'model' })
})

// using the app.route('route').METHOD syntax
app.route('/testlink2').get(function (req, res) {
  console.log('req object:', req)
  console.log('req.query:', req.query)
  res.render('someOtherTemplate', { someOther: 'model' })
})

// test with params
app.route('/test/:with/:params').get(function (req, res) {
  console.log('req object:', req)
  console.log('req.params:', req.params)
  res.render('someOtherTemplate', { someOther: 'model' })
})

// test with wildcards
// which wildcard syntax to use depends on which version of the express api you target
const wildcardRoute = app.expressVersion === 5 ? '/wildcard/*all' : '/wildcard/*'
app.route(wildcardRoute).get(function (req, res) {
  console.log('req object:', req)
  console.log('req.route:', req.route)
  res.render('someOtherTemplate', { someOther: 'model' })
})

// test a form
app.route('/testform').post(function (req, res) {
  console.log('req object:', req)
  console.log('req.body:', req.body)
  res.render('someOtherTemplate', { someOther: 'model' })
})
