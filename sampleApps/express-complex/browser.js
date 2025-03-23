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

  // which DOM elements will be updated by default when routes are triggered
  defaultTargets: [
    'body > article',
    'body > header > h2'
  ],

  // tailor animations based on which page is being visited and handle animations using css animations if view transitions are not supported
  beforeEveryRender: (params) => {
    // if the last visited page is the current page, do a fade animation, not a slide
    if (!params.targets.includes('body > article') || !params.doc.querySelector('body > article') || params.doc.querySelector('body > article').id === window.lastPageId) {
      document.querySelector('html').classList.add('fade')
    } else {
      document.querySelector('html').classList.remove('fade')
    }

    // handle browsers without view transitions support
    if (!document.startViewTransition) {
      // hide horizontal scrollbar for non-view transitions browsers during animations
      window.oldBodyOverflow = window.getComputedStyle(document.body).overflow // store original value of the body tag's overflow css property
      document.body.style.overflow = 'hidden'

      // if the last visited page is the current page, do a fade animation, not a slide
      if (!params.targets.includes('body > article') || !params.doc.querySelector('body > article') || params.doc.querySelector('body > article').id === window.lastPageId) {
        document.querySelector('body > header > h2').style.animation = 'var(--fade-out)'
        document.querySelector('body > article').style.animation = 'var(--fade-out)'
      } else {
        // handle the default animations
        if (!document.querySelector('html.backButtonPressed')) { // when the back button was not pressed
          document.querySelector('body > header > h2').style.animation = 'var(--fade-out), var(--slide-to-left)'
          document.querySelector('body > article').style.animation = 'var(--fade-out), var(--slide-to-left)'
        } else { // when the back button was pressed, reverse the animation direction
          document.querySelector('body > header > h2').style.animation = 'var(--fade-out), var(--slide-to-right)'
          document.querySelector('body > article').style.animation = 'var(--fade-out), var(--slide-to-right)'
        }
      }
    }
  },

  // delay is only needed for css animations; not for view transitions
  updateDelay: !document.startViewTransition ? 90 : 0,

  afterEveryRender: (params) => {
    // if the last visited page is the current page, do a fade animation, not a slide
    if (!params.targets.includes('body > article') || !params.doc.querySelector('body > article') || params.doc.querySelector('body > article').id === window.lastPageId) {
      document.querySelector('body > header > h2').style.animation = 'var(--fade-in)'
      document.querySelector('body > article').style.animation = 'var(--fade-in)'
    }

    // handle browsers without view transitions support
    if (!document.startViewTransition) {
      if (params.doc.querySelector('body > article') && params.doc.querySelector('body > article').id !== window.lastPageId) {
        // handle the default animations
        if (!document.querySelector('html.backButtonPressed')) { // when the back button was not pressed
          document.querySelector('body > header > h2').style.animation = 'var(--fade-in), var(--slide-from-right)'
          document.querySelector('body > article').style.animation = 'var(--fade-in), var(--slide-from-right)'
        } else { // when the back button was pressed, reverse the animation direction
          document.querySelector('body > header > h2').style.animation = 'var(--fade-in), var(--slide-from-left)'
          document.querySelector('body > article').style.animation = 'var(--fade-in), var(--slide-from-left)'
        }
      }
      window.setTimeout(() => {
        // remove changes to the body overflow style for non-view transitions browsers
        document.body.style.overflow = window.oldBodyOverflow
        window.lastPageId = document.querySelector('body > article').id
      }, app.updateDelay * 2)
    }
  }
})

document.addEventListener('animationend', () => {
  // set last page visited to the current page (this isn't updated until the view transition is done)
  window.lastPageId = document.querySelector('body > article').id
})

// set last page visited to the current page on the first page load
window.lastPageId = document.querySelector('body > article').id

// load the same routes as the express server
require('./mvc/routes')(app)

// set hovering nav only if js is enabled because the margin of #page-contents needs to be calculated dynamically based on whatever the height of the nav box is
document.querySelector('nav').style.position = 'fixed'
document.querySelector('nav').style.top = document.querySelector('nav').offsetTop + 'px'
document.querySelector('nav').style.width = 'calc(100% - 15px)'
function setContainerMargin () {
  // it so #page-contents doesn't overlap the nav
  document.querySelector('body > p').style.marginBottom = `${document.querySelector('nav').offsetHeight + 30}px`
}
setContainerMargin()
window.addEventListener('resize', setContainerMargin)
