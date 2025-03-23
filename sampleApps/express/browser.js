// load single page express, the teddy templating system, and the templates
const singlePageExpress = require('../../single-page-express') // use require('single-page-express') in your app
const teddy = require('teddy/client')
const templates = require('./public/templates')

// register the templates with the teddy templating system
Object.entries(templates).forEach(([name, template]) => teddy.setTemplate(name, template))

// start single-page-express
const app = singlePageExpress({
  templatingEngine: teddy,
  templates,
  defaultTarget: '#page-contents',

  // handle animations using css transitions if view transitions are not supported
  beforeEveryRender: () => {
    if (!document.startViewTransition) {
      document.querySelector('#page-contents').style.opacity = 0
    }
  },

  // delay is only needed for css transitions; not for view transitions
  updateDelay: !document.startViewTransition ? 90 : 0,

  afterEveryRender: () => {
    if (!document.startViewTransition) {
      document.querySelector('#page-contents').style.opacity = 1
    }
  }
})

// apply fallback crossfade css transition styles only if view transitions are not supported
if (!document.startViewTransition) {
  document.body.insertAdjacentHTML('beforeend', '<style>#page-contents { opacity: 0; transition: opacity 0.09s ease }</style>')
  document.querySelector('#page-contents').style.opacity = 1
}

// load the same routes as the express server
require('./mvc/routes')(app)
