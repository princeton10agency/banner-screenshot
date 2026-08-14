const fs = require('fs')
const path = require('path')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function getVariantDirs(distDir) {
  if (!fs.existsSync(distDir)) {
    return []
  }

  return fs.readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(distDir, entry.name))
    .filter((dirPath) => fs.existsSync(path.join(dirPath, 'index.html')))
    .sort()
}

function parseSizeFromId(id) {
  const match = String(id || '').match(/(\d+)\s*x\s*(\d+)/i)
  if (!match) {
    return null
  }
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return { width, height }
}

function resolveBrowserPath() {
  return process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    process.env.CHROME_PATH ||
    process.env.GOOGLE_CHROME_PATH ||
    process.env.CHROMIUM_PATH ||
    process.env.CHROMIUM_BROWSER_PATH ||
    undefined
}

async function launchBrowser() {
  let playwright
  try {
    playwright = require('playwright')
  } catch (_error) {
    playwright = require('playwright-core')
  }

  const launchOptions = { headless: true, args: ['--no-sandbox'] }
  const executablePath = resolveBrowserPath()
  if (executablePath) {
    launchOptions.executablePath = executablePath
  }

  try {
    return await playwright.chromium.launch(launchOptions)
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    throw new Error([
      'Unable to launch Chromium for screenshots.',
      'Install a Playwright browser build or set PLAYWRIGHT_CHROMIUM_PATH/CHROME_PATH.',
      `Original error: ${message}`
    ].join(' '))
  }
}

module.exports = {
  readJson,
  getVariantDirs,
  parseSizeFromId,
  resolveBrowserPath,
  launchBrowser
}
