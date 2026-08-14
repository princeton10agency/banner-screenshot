const { pathToFileURL } = require('url')
const path = require('path')

// Reuse shared helpers from isi-screenshot
const { getIsiInitScript, settleIsiInstances, expandIsiForScreenshot, waitForPageReady } = require('./isi-screenshot.cjs')

// Reuse JS resolution from frame-screenshot
const { resolveJsEntry, resolveJsImport, getFrameNumbers } = require('./frame-screenshot.cjs')

const fs = require('fs')

/**
 * Inline all JS imports (same approach as getFrameNumbers) to get bundled source.
 */
function bundleJsSource(jsEntry) {
  const seen = new Set()

  const inlineImports = (filePath) => {
    const normalized = path.resolve(filePath)
    if (seen.has(normalized)) {
      return ''
    }
    seen.add(normalized)

    let content = fs.readFileSync(normalized, 'utf8')
    content = content.replace(/^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm, (_line, spec) => {
      const resolved = resolveJsImport(normalized, spec)
      return inlineImports(resolved)
    })

    return `${content.trim()}\n`
  }

  return inlineImports(jsEntry)
}

/**
 * Extract the autoPlayStartDelay value from banner JS source.
 * Returns { type, value } where:
 *   type: 'static'  -> value is a number (seconds)
 *   type: 'dynamic' -> value is null (needs runtime evaluation)
 *   type: 'missing' -> no ISI found
 */
function extractIsiStartDelay(projectRoot, scriptFile) {
  try {
    const jsEntry = resolveJsEntry(projectRoot, scriptFile)
    const bundled = bundleJsSource(jsEntry)

    // Pattern 1: static number, e.g. autoPlayStartDelay: 8
    const staticMatch = bundled.match(/autoPlayStartDelay\s*:\s*(\d+(?:\.\d+)?)/)
    if (staticMatch) {
      return { type: 'static', value: parseFloat(staticMatch[1]) }
    }

    // Pattern 2: dynamic expression, e.g. (tl ? tl.duration() : 0) + 2
    if (bundled.includes('autoPlayStartDelay')) {
      return { type: 'dynamic', value: null }
    }

    return { type: 'missing', value: null }
  } catch (_error) {
    return { type: 'missing', value: null }
  }
}

/**
 * Init script that captures the autoPlayStartDelay from ISI options.
 * Exposes it on window.__bannerBuildIsiTiming for the caller to read.
 */
function getIsiTimingInitScript() {
  return () => {
    const state = { startDelay: null }

    Object.defineProperty(window, '__bannerBuildIsiTiming', {
      configurable: true,
      enumerable: false,
      value: state
    })

    const wrapCtor = (Ctor) => {
      if (typeof Ctor !== 'function') return Ctor

      const wrapped = new Proxy(Ctor, {
        construct(target, args, newTarget) {
          const instance = Reflect.construct(target, args, newTarget)
          // Capture the autoPlayStartDelay from options (second argument)
          if (args && args.length >= 2 && typeof args[1] === 'object') {
            try {
              state.startDelay = args[1].autoPlayStartDelay || null
            } catch (_error) { /* ignore */ }
          }
          return instance
        }
      })

      try {
        Object.defineProperty(wrapped, 'prototype', {
          configurable: false,
          enumerable: false,
          value: Ctor.prototype,
          writable: false
        })
      } catch (_error) { /* ignore */ }

      return wrapped
    }

    let currentCtor = null
    Object.defineProperty(window, 'ISI', {
      configurable: true,
      enumerable: true,
      get() { return currentCtor },
      set(value) { currentCtor = wrapCtor(value) }
    })
  }
}

/**
 * Navigate to the banner, wait for the ISI start delay (end of animation),
 * then capture a screenshot.
 */
async function captureIsiTimingScreenshot(page, variantDir, outputPath) {
  const url = pathToFileURL(path.join(variantDir, 'index.html')).href
  await page.goto(url, { waitUntil: 'load' })

  await waitForPageReady(page)

  // Read the captured start delay from the init script
  const timing = await page.evaluate(() => {
    const state = window.__bannerBuildIsiTiming
    return state && state.startDelay != null ? state.startDelay : null
  })

  if (timing != null && timing > 0) {
    // Wait for the ISI start delay (seconds -> milliseconds) + buffer
    const waitMs = timing * 1000 + 200
    await page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), waitMs)
  }

  await page.screenshot({
    path: outputPath,
    animations: 'disabled',
    fullPage: false
  })
}

/**
 * Top-level capture routine for ISI-timing screenshots.
 * For banners without frame markers, captures one screenshot at the
 * moment the ISI is scheduled to start (end of banner animation).
 */
async function captureIsiTimingScreenshots(projectRoot, outputDir) {
  const configPath = path.join(projectRoot, 'creative.config.json')
  if (!fs.existsSync(configPath)) {
    console.log(`Skipping ISI timing screenshots: creative.config.json not found at ${configPath}`)
    return
  }

  const config = require('./utils.cjs').readJson(configPath)
  const sizes = Array.isArray(config && config.sizes) ? config.sizes : []
  const distDir = path.join(projectRoot, 'dist')
  const variantDirs = require('./utils.cjs').getVariantDirs(distDir)
  if (variantDirs.length === 0) {
    console.log(`Skipping ISI timing screenshots: no variant directories found in ${distDir}`)
    return
  }

  const projectName = path.basename(projectRoot)
  const stageDir = path.join(outputDir, '.isi-timing-stage')
  const zipPath = path.join(outputDir, `${projectName}-isi-timing-screenshots.zip`)

  fs.rmSync(stageDir, { recursive: true, force: true })
  fs.mkdirSync(stageDir, { recursive: true })

  const { launchBrowser } = require('./utils.cjs')
  const browser = await launchBrowser()
  let totalCaptured = 0

  try {
    for (const variantDir of variantDirs) {
      const variantName = path.basename(variantDir)

      // Determine which size config to use for this variant
      let sizeConfig = null
      for (const size of sizes) {
        const id = size.id || ''
        if (variantName.includes(id)) {
          sizeConfig = size
          break
        }
      }

      // Resolve script file from config or default
      const scriptFile = sizeConfig && sizeConfig.javascript
        ? path.basename(sizeConfig.javascript)
        : 'main.js'

      // Check for frame markers first - skip if frames exist
      const frameNumbers = getFrameNumbers(projectRoot, scriptFile)
      if (frameNumbers.length > 0) {
        console.log(`Skipping ${variantName}: has ${frameNumbers.length} frame(s), use --frame-screenshots instead`)
        continue
      }

      // Check for ISI timing
      const delayInfo = extractIsiStartDelay(projectRoot, scriptFile)
      if (delayInfo.type === 'missing') {
        console.log(`No ISI timing found in ${variantName}, skipping`)
        continue
      }

      const page = await browser.newPage()
      try {
        // Inject init script to capture ISI options
        await page.addInitScript(getIsiTimingInitScript())

        // Set viewport to the variant size
        const dims = require('./utils.cjs').parseSizeFromId(sizeConfig && sizeConfig.id)
        if (dims) {
          await page.setViewportSize({
            width: Math.max(1, dims.width),
            height: Math.max(1, dims.height)
          })
        }

        const outputPath = path.join(stageDir, `${variantName}-isi-end.png`)
        await captureIsiTimingScreenshot(page, variantDir, outputPath)
        totalCaptured += 1
        console.log(`Captured ISI timing screenshot: ${variantName} (delay: ${delayInfo.type === 'static' ? delayInfo.value + 's' : 'dynamic'})`)
      } finally {
        await page.close().catch(() => {})
      }
    }

    if (totalCaptured > 0) {
      require('./zip.cjs').createZip(stageDir, zipPath)
      console.log(`Created ${path.relative(outputDir, zipPath)} (${totalCaptured} ISI timing screenshot(s))`)
    } else {
      console.log('No ISI timing screenshots captured (all banners have frame markers or lack ISI)')
    }
  } finally {
    await browser.close().catch(() => {})
    fs.rmSync(stageDir, { recursive: true, force: true })
  }
}

module.exports = {
  extractIsiStartDelay,
  getIsiTimingInitScript,
  captureIsiTimingScreenshot,
  captureIsiTimingScreenshots
}
