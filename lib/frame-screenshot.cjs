const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

function findMatchingBrace(content, openIndex) {
  let depth = 0
  for (let i = openIndex; i < content.length; i += 1) {
    const char = content[i]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

function resolveJsEntry(projectRoot, scriptFile) {
  const sourceName = path.basename(scriptFile)
  const withExt = path.extname(sourceName) ? sourceName : `${sourceName}.js`
  const candidates = [
    path.join(projectRoot, withExt),
    path.join(projectRoot, 'js', withExt)
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  throw new Error(`Missing JS entry for script "${scriptFile}"`)
}

function resolveJsImport(fromFile, spec) {
  const fromDir = path.dirname(fromFile)
  const importPath = path.resolve(fromDir, spec)
  const hasExt = path.extname(importPath) !== ''
  const candidates = hasExt ? [importPath] : [`${importPath}.js`, path.join(importPath, 'index.js')]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  throw new Error(`Unable to resolve JS import "${spec}" from ${fromFile}`)
}

function getFrameNumbers(projectRoot, scriptFile) {
  const jsEntry = resolveJsEntry(projectRoot, scriptFile)
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

  const bundled = inlineImports(jsEntry)
  const frameNumbers = new Set()
  const regex = /addLabel\(\s*['"]frame(\d+)['"]/g
  let match

  while ((match = regex.exec(bundled)) !== null) {
    frameNumbers.add(Number(match[1]))
  }

  return Array.from(frameNumbers)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
}

async function captureFrameScreenshot(page, variantDir, frameNumber, outputPath) {
  const url = pathToFileURL(path.join(variantDir, 'index.html')).href
  await page.goto(`${url}?frame=${frameNumber}`, {
    waitUntil: 'load'
  })

  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
  })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100)))

  await page.screenshot({
    path: outputPath,
    animations: 'disabled',
    fullPage: false
  })
}

module.exports = {
  findMatchingBrace,
  resolveJsEntry,
  getFrameNumbers,
  captureFrameScreenshot
}
