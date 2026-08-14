#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const AdmZip = require('adm-zip')

const ROOT = path.resolve(__dirname, '..')
const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'isi-screenshot-fixture')
const TIMING_FIXTURE = path.join(ROOT, 'test', 'fixtures', 'isi-timing-fixture')

function listZipEntries(zipPath) {
  const zip = new AdmZip(zipPath)
  return zip.getEntries().map((entry) => entry.entryName)
}

function extractZipEntry(zipPath, entryName) {
  const zip = new AdmZip(zipPath)
  return zip.getEntry(entryName).getData()
}

function hasPlaywright() {
  try {
    require.resolve('playwright')
    return true
  } catch (_error) {
    try {
      require.resolve('playwright-core')
      return true
    } catch (_fallbackError) {
      return false
    }
  }
}

async function hasChromium() {
  try {
    const playwright = (() => {
      try {
        return require('playwright')
      } catch (_error) {
        return require('playwright-core')
      }
    })()
    const launchOptions = { headless: true }
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ||
      process.env.CHROME_PATH ||
      process.env.GOOGLE_CHROME_PATH ||
      process.env.CHROMIUM_PATH ||
      process.env.CHROMIUM_BROWSER_PATH
    if (executablePath) {
      launchOptions.executablePath = executablePath
    }
    const browser = await playwright.chromium.launch({ ...launchOptions, args: ['--no-sandbox'] })
    await browser.close()
    return true
  } catch (_error) {
    return false
  }
}

async function testIsiScreenshot() {
  const projectName = path.basename(FIXTURE)
  const outputDir = path.join(FIXTURE, 'test-output-isi')
  fs.mkdirSync(outputDir, { recursive: true })

  const { captureIsiScreenshots } = require(path.join(ROOT, 'lib', 'capture.cjs'))
  await captureIsiScreenshots(FIXTURE, outputDir)

  const screenshotZip = path.join(outputDir, `${projectName}-isi-screenshots.zip`)
  if (!fs.existsSync(screenshotZip)) {
    throw new Error('Expected ISI screenshot zip to be created')
  }

  const entries = listZipEntries(screenshotZip)
  if (entries.length < 1) {
    throw new Error('Expected at least one entry in ISI screenshot zip')
  }

  // Verify PNG dimensions
  const pngEntry = entries.find((e) => e.endsWith('.png'))
  if (!pngEntry) {
    throw new Error('Expected a PNG entry in ISI screenshot zip')
  }

  const buffer = extractZipEntry(screenshotZip, pngEntry)
  const metadata = await sharp(buffer).metadata()

  if (metadata.width !== 300) {
    throw new Error(`Expected ISI screenshot width 300, got ${metadata.width}`)
  }
  if (metadata.height <= 250) {
    throw new Error(`Expected ISI screenshot height > 250 (full scroll), got ${metadata.height}`)
  }

  console.log('  ISI screenshot: width=' + metadata.width + ', height=' + metadata.height + ' (full scroll)')
  fs.rmSync(outputDir, { recursive: true, force: true })
}

async function testFrameScreenshot() {
  const projectName = path.basename(FIXTURE)
  const outputDir = path.join(FIXTURE, 'test-output-frame')
  fs.mkdirSync(outputDir, { recursive: true })

  const { captureFrameScreenshots } = require(path.join(ROOT, 'lib', 'capture.cjs'))
  await captureFrameScreenshots(FIXTURE, outputDir)

  const frameZip = path.join(outputDir, `${projectName}-frame-screenshots.zip`)
  if (!fs.existsSync(frameZip)) {
    throw new Error('Expected frame screenshot zip to be created')
  }

  const entries = listZipEntries(frameZip)
  const pngEntries = entries.filter((e) => e.endsWith('.png'))
  if (pngEntries.length !== 3) {
    throw new Error(`Expected 3 frame PNGs, got ${pngEntries.length}: ${pngEntries.join(', ')}`)
  }

  // Verify each frame PNG has correct dimensions
  for (const entry of pngEntries) {
    const buffer = extractZipEntry(frameZip, entry)
    const metadata = await sharp(buffer).metadata()
    if (metadata.width !== 300) {
      throw new Error(`Expected frame screenshot width 300 for ${entry}, got ${metadata.width}`)
    }
    if (metadata.height !== 250) {
      throw new Error(`Expected frame screenshot height 250 for ${entry}, got ${metadata.height}`)
    }
  }

  console.log('  Frame screenshots: 3 frames, all 300x250')
  fs.rmSync(outputDir, { recursive: true, force: true })
}

async function testIsiTimingScreenshot() {
  const projectName = path.basename(TIMING_FIXTURE)
  const outputDir = path.join(TIMING_FIXTURE, 'test-output-timing')
  fs.mkdirSync(outputDir, { recursive: true })

  const { captureIsiTimingScreenshots } = require(path.join(ROOT, 'lib', 'capture.cjs'))
  await captureIsiTimingScreenshots(TIMING_FIXTURE, outputDir)

  const timingZip = path.join(outputDir, `${projectName}-isi-timing-screenshots.zip`)
  if (!fs.existsSync(timingZip)) {
    throw new Error('Expected ISI timing screenshot zip to be created')
  }

  const entries = listZipEntries(timingZip)
  const pngEntries = entries.filter((e) => e.endsWith('.png'))
  if (pngEntries.length < 1) {
    throw new Error('Expected at least one PNG in ISI timing screenshot zip')
  }

  // Verify dimensions match creative size
  for (const entry of pngEntries) {
    const buffer = extractZipEntry(timingZip, entry)
    const metadata = await sharp(buffer).metadata()
    if (metadata.width !== 300) {
      throw new Error(`Expected timing screenshot width 300 for ${entry}, got ${metadata.width}`)
    }
    if (metadata.height !== 250) {
      throw new Error(`Expected timing screenshot height 250 for ${entry}, got ${metadata.height}`)
    }
  }

  console.log('  ISI timing screenshots: ' + pngEntries.length + ' screenshot(s), all 300x250')
  fs.rmSync(outputDir, { recursive: true, force: true })
}

async function testAllModesOnTimingFixture() {
  // The timing fixture has no frame markers and no ISI capture element,
  // so ISI and frame modes should be gracefully skipped while timing succeeds.
  const outputDir = path.join(TIMING_FIXTURE, 'test-output-all')
  fs.mkdirSync(outputDir, { recursive: true })

  const { captureIsiScreenshots, captureFrameScreenshots, captureIsiTimingScreenshots } = require(path.join(ROOT, 'lib', 'capture.cjs'))

  // All three should resolve without throwing
  await Promise.all([
    captureIsiScreenshots(TIMING_FIXTURE, outputDir),
    captureFrameScreenshots(TIMING_FIXTURE, outputDir),
    captureIsiTimingScreenshots(TIMING_FIXTURE, outputDir)
  ])

  // Only timing zip should exist
  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.zip'))
  const timingZip = files.find((f) => f.includes('isi-timing'))
  if (!timingZip) {
    throw new Error('Expected ISI timing zip after --all on timing fixture')
  }

  const isiZip = files.find((f) => f.includes('-isi-screenshots') && !f.includes('timing'))
  if (isiZip) {
    throw new Error('Did not expect ISI screenshots zip (fixture has no #isi-holder)')
  }

  const frameZip = files.find((f) => f.includes('frame-screenshots'))
  if (frameZip) {
    throw new Error('Did not expect frame screenshots zip (fixture has no frame markers)')
  }

  console.log('  Mixed mode: only timing zip created, ISI and frame gracefully skipped')
  fs.rmSync(outputDir, { recursive: true, force: true })
}

async function testOutputDirFlag() {
  const projectName = path.basename(FIXTURE)
  const customOutput = path.join(FIXTURE, 'custom-output')
  fs.mkdirSync(customOutput, { recursive: true })

  const { captureIsiScreenshots } = require(path.join(ROOT, 'lib', 'capture.cjs'))
  await captureIsiScreenshots(FIXTURE, customOutput)

  const screenshotZip = path.join(customOutput, `${projectName}-isi-screenshots.zip`)
  if (!fs.existsSync(screenshotZip)) {
    throw new Error('Expected ISI screenshot zip in custom output directory')
  }

  console.log('  Custom output dir: zip created at correct path')
  fs.rmSync(customOutput, { recursive: true, force: true })
}

async function main() {
  if (!hasPlaywright()) {
    console.log('Playwright not installed, skipping tests.')
    return
  }

  if (!(await hasChromium())) {
    console.log('Chromium not available, skipping tests.')
    return
  }

  console.log('Running integration tests...')

  console.log('  Test: ISI screenshot capture')
  await testIsiScreenshot()

  console.log('  Test: Frame screenshot capture')
  await testFrameScreenshot()

  console.log('  Test: ISI timing screenshot capture')
  await testIsiTimingScreenshot()

  console.log('  Test: All modes on timing fixture (graceful skip)')
  await testAllModesOnTimingFixture()

  console.log('  Test: Custom output directory')
  await testOutputDirFlag()

  console.log('\nAll integration tests passed.')
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error))
  process.exitCode = 1
})
