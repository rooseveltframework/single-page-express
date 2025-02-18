module.exports = function (app) {
  app.get('/', (req, res) => {
    res.render('index', {})
  })

  app.get('/secondPage', (req, res) => {
    res.render('secondPage', { variable: 'variable with contents: "hi there!"' })
  })

  app.get('/pageWithForm', (req, res) => {
    res.render('pageWithForm', {})
  })

  app.post('/pageWithForm', (req, res) => {
    console.log('req.body:', req.body)
    res.render('pageWithForm', req.body)
  })

  app.get('/pageWithDataRetrieval', async (req, res) => {
    const model = await require('models/getRandomNumber')()
    res.render('pageWithDataRetrieval', model)
  })

  app.get('/pageWithTitleOverride', (req, res) => {
    res.title = 'Different Page Title'
    res.render('index', {})
  })

  app.get('/routeUsingTarget', (req, res) => {
    res.target = '#page-contents'
    if (req.singlePageExpress) res.render('partial', {})
    else res.redirect('/')
  })

  app.get('/route/:withParam/:anotherParam', (req, res) => {
    res.render('params', { withParam: req.params.withParam, anotherParam: req.params.anotherParam })
  })

  app.get('/verbosePage', (req, res) => {
    res.render('verbosePage', {})
  })

  app.get('/additionalHeadTags', (req, res) => {
    res.render('additionalHeadTags', {})
  })
}
