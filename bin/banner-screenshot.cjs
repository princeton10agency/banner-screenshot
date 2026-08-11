#!/usr/bin/env node
const path = require('path')
const fs = require('fs')

const { captureIsiScreenshots, captureFrameScreenshots } = require('../lib/capture.cjs')

function parseArgs(argv) {
  const flags = {
    isiScreenshots: false,
    frameScreenshots: false,
    help: false
  }
  const positional = []

  for (const arg of argv) {
    if (arg === '--isi-screenshots') {
      flags.isiScreenshots = true
      continue
    }
    if (arg === '--frame-screenshots') {
      flags.frameScreenshots = true
      continue
    }
    if (arg === '--all') {
      flags.isiScreenshots = true
      flags.frameScreenshots = true
      continue
    }
    if (arg === '--output' || arg === '-o') {
      const next = argv[argv.indexOf(arg) + 1]
      if (!next) {
        throw new Error('--output requires a path argument')
      }
      flags.output = next
      continue
    }
    if (arg === '--help' || arg === '-h') {
      flags.help = true
      continue
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`)
    }
    positional.push(arg)
  }

  return { flags, positional }
}

function printHelp() {
  console.log([
    'usage: banner-screenshot [path] [--isi-screenshots] [--frame-screenshots] [--all] [--output <dir>]',
    '',
    'Captures screenshots of built banner variants in the dist/ directory.',
    '',
    'Flags:',
    '  --isi-screenshots     Capture full-height ISI screenshots',
    '  --frame-screenshots   Capture screenshots of each animation frame',
    '  --all                 Capture both ISI and frame screenshots',
    '  --output, -o <dir>    Output directory (default: ./screenshots/)',
    '  --help, -h            Show this help message',
    '',
    'ISI screenshot config in creative.config.json:',
    '  {',
    '    "isi_screenshots": {',
    '      "enabled": true,',
    '      "hide_selectors": [".isi-sticky-header", ".isi-close-button"]',
    '    }',
    '  }',
    '',
    'Frame screenshots use addLabel("frameN") markers found in banner JavaScript.'
  ].join('\n'))
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2))

  if (flags.help) {
    printHelp()
    return Promise.resolve()
  }

  if (!flags.isiScreenshots && !flags.frameScreenshots) {
    console.log('No screenshot mode specified. Use --isi-screenshots, --frame-screenshots, or --all.')
    printHelp()
    process.exitCode = 1
    return
  }

  const targetPath = path.resolve(process.cwd(), positional[0] || '.')
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target path does not exist: ${targetPath}`)
  }
  if (!fs.statSync(targetPath).isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetPath}`)
  }

  const outputDir = flags.output || path.join(targetPath, 'screenshots')
  fs.mkdirSync(outputDir, { recursive: true })

  const tasks = []
  if (flags.isiScreenshots) {
    tasks.push(captureIsiScreenshots(targetPath, outputDir))
  }
  if (flags.frameScreenshots) {
    tasks.push(captureFrameScreenshots(targetPath, outputDir))
  }

  return Promise.all(tasks)
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error))
  process.exitCode = 1
})
