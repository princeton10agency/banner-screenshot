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

module.exports = {
  readJson,
  getVariantDirs,
  parseSizeFromId
}
