const singlePageExpress = require('../../single-page-express') // use require('single-page-express') in your app
const teddy = require('teddy/client')

// start single-page-express
const app = singlePageExpress({
  templatingEngine: teddy,
  templates: require('./public/templates'),
  defaultTarget: '#page-contents',
  updateDelay: 200,
  beforeEveryRender: function () {
    document.querySelector(app.defaultTarget).style.opacity = 0
  },
  afterEveryRender: function () {
    document.querySelector(app.defaultTarget).style.opacity = 1
  }
})

// load the same routes as the express server
require('./mvc/routes')(app)

// register the templates with the teddy templating system
Object.entries(app.templates).forEach(([name, template]) => teddy.setTemplate(name, template))
