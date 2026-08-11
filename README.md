# @p10agency/banner-screenshot

CLI for capturing ISI (Indication & Safety Info) and frame screenshots of built banner projects.

## Install

```bash
npm install --save-dev @p10agency/banner-screenshot
```

## Usage

After building your banner project with `banner-build`, run:

```bash
# Capture full-height ISI screenshots
npx banner-screenshot . --isi-screenshots

# Capture screenshots of each animation frame
npx banner-screenshot . --frame-screenshots

# Capture both
npx banner-screenshot . --all

# Write to a custom output directory
npx banner-screenshot . --all --output ./screenshots
```

Screenshots are packaged into a zip file per mode:
- `<project>-isi-screenshots.zip` — one PNG per variant (full-height ISI capture)
- `<project>-frame-screenshots.zip` — one PNG per frame per variant

By default output goes to `./screenshots/` inside the project root.

## ISI Screenshot Config

Enable ISI screenshot capture in `creative.config.json`:

```json
{
  "isi_screenshots": {
    "enabled": true,
    "hide_selectors": [
      ".isi-sticky-header",
      ".isi-close-button",
      ".isi-footer",
      ".iScrollVerticalScrollbar"
    ]
  }
}
```

### Config Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Enable ISI screenshot capture |
| `hide_selectors` | string[] | Built-in defaults | CSS selectors to hide during capture |
| `capture_selector` | string | `#isi-holder` | Element to screenshot |
| `shell_selector` | string | `#isi` | ISI shell container |
| `wrapper_selector` | string | `#wrapper` | ISI wrapper element |
| `scroller_selector` | string | `#scroller` | ISI content scroller |

Built-in `hide_selectors` (always applied):
- `.iScrollVerticalScrollbar`
- `.isi-footer`
- `#isi_prescribing_exit`
- `[aria-label="Close"]`

Custom selectors are merged with the built-in list.

## Frame Screenshots

Frame screenshots detect animation frame markers in your banner JavaScript. The tool looks for `addLabel('frameN')` calls (matching the GSAP timeline pattern used by banner-build's frame feature).

Each detected frame produces a screenshot at the variant's configured size, using the `?frame=N` query parameter to navigate to that frame.

## Browser Requirements

A Chromium executable must be available. Set one of these environment variables:

- `PLAYWRIGHT_CHROMIUM_PATH`
- `CHROME_PATH`
- `GOOGLE_CHROME_PATH`
- `CHROMIUM_PATH`
- `CHROMIUM_BROWSER_PATH`

Or install Playwright browsers:

```bash
npx playwright install chromium
```

## Make Target Example

Add to your `Makefile`:

```makefile
.PHONY: screenshots
screenshots:
	banner-build .
	banner-screenshot . --all --output ./screenshots
```

## Programmatic API

```js
const { captureIsiScreenshots, captureFrameScreenshots } = require('@p10agency/banner-screenshot/lib/capture.cjs')

await captureIsiScreenshots('/path/to/project', '/path/to/output')
await captureFrameScreenshots('/path/to/project', '/path/to/output')
```
