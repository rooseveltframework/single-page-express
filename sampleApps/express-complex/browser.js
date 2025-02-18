const singlePageExpress = require('../../single-page-express') // use require('./node_modules/single-page-express/dist/single-page-express.cjs') in your app
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

// set margin of contents to be whatever the height of the nav element is
function setContainerMargin () {
  document.getElementById('page-contents').style.marginTop = `${document.querySelector('nav').offsetHeight + 50}px`
}

setContainerMargin()
window.addEventListener('resize', setContainerMargin)
