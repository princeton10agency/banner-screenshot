const fs = require('fs')
const path = require('path')

const AdmZip = require('adm-zip')

function createZip(sourceDir, zipPath) {
  const zip = new AdmZip()
  zip.addLocalFolder(sourceDir)
  zip.writeZip(zipPath)
}

module.exports = {
  createZip
}
