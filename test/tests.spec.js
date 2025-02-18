const { test, expect } = require('@playwright/test')
const { spawn } = require('child_process')
let server

test.beforeAll(async () => {
  server = spawn('npm', ['run', 'express-complex'])
  await new Promise((resolve) => {
    server.stdout.on('data', (data) => {
      console.log(data.toString())
      if (data.toString().includes('server is running on')) {
        resolve()
      }
    })
  })
})

test.afterAll(() => {
  server.kill()
})

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log(msg.text()))
})

test('should render the homepage correctly', async ({ page }) => {
  await page.goto('/')
  const resultText = await page.textContent('#page-contents p')
  expect(resultText).toBe('hello world')
})

test('should render the second page correctly', async ({ page }) => {
  await page.goto('/')
  await page.click('a[href="/secondPage"]')
  await page.waitForTimeout(2000)
  const resultText = await page.textContent('#page-contents p')
  expect(resultText).toBe('this is a second page and prints a variable with contents: "hi there!"')
})
