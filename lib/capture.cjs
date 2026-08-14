const fs = require('fs')
const path = require('path')

const { resolveScreenshotConfig } = require('./config.cjs')
const { getIsiInitScript, captureIsiScreenshot } = require('./isi-screenshot.cjs')
const { getFrameNumbers, captureFrameScreenshot } = require('./frame-screenshot.cjs')
const { captureIsiTimingScreenshots } = require('./isi-timing-screenshot.cjs')
const { createZip } = require('./zip.cjs')
const { readJson, getVariantDirs, parseSizeFromId, launchBrowser } = require('./utils.cjs')

const STAGE_DIR_NAME = '.screenshot-stage'

async function captureIsiScreenshots(projectRoot, outputDir) {
  const configPath = path.join(projectRoot, 'creative.config.json')
  if (!fs.existsSync(configPath)) {
    console.log(`Skipping ISI screenshots: creative.config.json not found at ${configPath}`)
    return
  }

  const config = readJson(configPath)
  const screenshotConfig = resolveScreenshotConfig(config)
  if (!screenshotConfig.enabled) {
    console.log(`Skipping ISI screenshots: isi_screenshots is missing or disabled`)
    return
  }

  const distDir = path.join(projectRoot, 'dist')
  const variantDirs = getVariantDirs(distDir)
  if (variantDirs.length === 0) {
    console.log(`Skipping ISI screenshots: no variant directories found in ${distDir}`)
    return
  }

  const projectName = path.basename(projectRoot)
  const stageDir = path.join(outputDir, STAGE_DIR_NAME)
  const zipPath = path.join(outputDir, `${projectName}-isi-screenshots.zip`)

  fs.rmSync(stageDir, { recursive: true, force: true })
  fs.mkdirSync(stageDir, { recursive: true })

  const browser = await launchBrowser()
  let totalCaptured = 0

  try {
    for (const variantDir of variantDirs) {
      const page = await browser.newPage()
      try {
        await page.addInitScript(getIsiInitScript())
        const variantName = path.basename(variantDir)
        const outputPath = path.join(stageDir, `${variantName}.png`)
        await captureIsiScreenshot(page, variantDir, screenshotConfig, outputPath)
        totalCaptured += 1
        console.log(`Captured ISI screenshot: ${variantName}`)
      } catch (error) {
        console.log(`Skipping ISI screenshot for ${path.basename(variantDir)}: ${error.message || error}`)
      } finally {
        await page.close().catch(() => {})
      }
    }

    if (totalCaptured > 0) {
      createZip(stageDir, zipPath)
      console.log(`Created ${path.relative(outputDir, zipPath)} (${totalCaptured} ISI screenshot(s))`)
    } else {
      console.log('No ISI screenshots captured (all variants failed or skipped)')
    }
  } finally {
    await browser.close().catch(() => {})
    fs.rmSync(stageDir, { recursive: true, force: true })
  }
}

async function captureFrameScreenshots(projectRoot, outputDir) {
  const configPath = path.join(projectRoot, 'creative.config.json')
  if (!fs.existsSync(configPath)) {
    console.log(`Skipping frame screenshots: creative.config.json not found at ${configPath}`)
    return
  }

  const config = readJson(configPath)
  const sizes = Array.isArray(config && config.sizes) ? config.sizes : []
  const distDir = path.join(projectRoot, 'dist')
  const variantDirs = getVariantDirs(distDir)
  if (variantDirs.length === 0) {
    console.log(`Skipping frame screenshots: no variant directories found in ${distDir}`)
    return
  }

  const projectName = path.basename(projectRoot)
  const stageDir = path.join(outputDir, STAGE_DIR_NAME)
  const zipPath = path.join(outputDir, `${projectName}-frame-screenshots.zip`)

  fs.rmSync(stageDir, { recursive: true, force: true })
  fs.mkdirSync(stageDir, { recursive: true })

  const browser = await launchBrowser()
  let totalFrames = 0

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

      const frameNumbers = getFrameNumbers(projectRoot, scriptFile)
      if (frameNumbers.length === 0) {
        console.log(`No frames detected in ${variantName}`)
        continue
      }

      console.log(`Found ${frameNumbers.length} frame(s) in ${variantName}`)

      for (const frameNumber of frameNumbers) {
        const page = await browser.newPage()
        try {
          // Set viewport to the variant size
          const dims = parseSizeFromId(sizeConfig && sizeConfig.id)
          if (dims) {
            await page.setViewportSize({
              width: Math.max(1, dims.width),
              height: Math.max(1, dims.height)
            })
          }

          const outputPath = path.join(stageDir, `${variantName}-frame${frameNumber}.png`)
          await captureFrameScreenshot(page, variantDir, frameNumber, outputPath)
          totalFrames += 1
          console.log(`Captured frame ${frameNumber}: ${variantName}`)
        } finally {
          await page.close().catch(() => {})
        }
      }
    }

    if (totalFrames > 0) {
      createZip(stageDir, zipPath)
      console.log(`Created ${path.relative(outputDir, zipPath)} (${totalFrames} frame screenshot(s))`)
    } else {
      console.log('No frame screenshots captured (no addLabel frame markers found)')
    }
  } finally {
    await browser.close().catch(() => {})
    fs.rmSync(stageDir, { recursive: true, force: true })
  }
}

module.exports = {
  captureIsiScreenshots,
  captureFrameScreenshots,
  captureIsiTimingScreenshots,
  launchBrowser
}
