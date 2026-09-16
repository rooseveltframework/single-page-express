// serves one of the sample apps in the sampleApps directory; used by the `npm run sample*` scripts
const { execSync } = require('node:child_process')
const path = require('node:path')
const express = require('express')

const port = 3000
const rootDir = path.join(__dirname, '..')

// each sample app declares a label for the startup message and which directories to serve statically
const sampleApps = {
  basicFrontendOnly: {
    label: 'basic frontend-only',
    staticDirs: [
      path.join(rootDir, 'sampleApps', 'basicFrontendOnly'),
      path.join(rootDir, 'dist')
    ]
  },
  basicFrontendOnlyWithTemplating: {
    label: 'basic frontend-only with templating',
    staticDirs: [
      path.join(rootDir, 'sampleApps', 'basicFrontendOnlyWithTemplating'),
      path.join(rootDir, 'dist'),
      path.join(rootDir, 'node_modules', 'teddy', 'dist')
    ]
  }
}

const name = process.argv[2]
const sampleApp = sampleApps[name]
if (!sampleApp) {
  console.error(`Unknown sample app: ${name}. Valid options: ${Object.keys(sampleApps).join(', ')}`)
  process.exit(1)
}

try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })
  const app = express()
  for (const staticDir of sampleApp.staticDirs) app.use(express.static(staticDir))
  app.listen(port, () => {
    console.log(`\n🎧 single-page-express ${sampleApp.label} sample app server is running on http://localhost:${port}`)
  })
} catch (error) {
  console.error('Failed to start sample app:', error.message)
  process.exit(1)
}
