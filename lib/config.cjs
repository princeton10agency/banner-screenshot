const ISI_SCREENSHOT_HIDE_SELECTORS = [
  '.iScrollVerticalScrollbar',
  '.isi-footer',
  '#isi_prescribing_exit',
  '[aria-label="Close"]'
]
const ISI_SCREENSHOT_CAPTURE_SELECTOR = '#isi-holder'
const ISI_SCREENSHOT_SHELL_SELECTOR = '#isi'
const ISI_SCREENSHOT_WRAPPER_SELECTOR = '#wrapper'
const ISI_SCREENSHOT_SCROLLER_SELECTOR = '#scroller'

function resolveScreenshotConfig(config) {
  const block = config && config.isi_screenshots
  if (!block || typeof block !== 'object') {
    return {
      enabled: false,
      captureSelector: ISI_SCREENSHOT_CAPTURE_SELECTOR,
      shellSelector: ISI_SCREENSHOT_SHELL_SELECTOR,
      wrapperSelector: ISI_SCREENSHOT_WRAPPER_SELECTOR,
      scrollerSelector: ISI_SCREENSHOT_SCROLLER_SELECTOR,
      hideSelectors: ISI_SCREENSHOT_HIDE_SELECTORS
    }
  }

  const customHideSelectors = Array.isArray(block.hide_selectors)
    ? block.hide_selectors.map((s) => String(s || '').trim()).filter(Boolean)
    : []

  const hideSelectors = Array.from(new Set([
    ...ISI_SCREENSHOT_HIDE_SELECTORS,
    ...customHideSelectors
  ]))

  return {
    enabled: block.enabled === true,
    captureSelector: typeof block.capture_selector === 'string' && block.capture_selector.trim()
      ? block.capture_selector.trim()
      : ISI_SCREENSHOT_CAPTURE_SELECTOR,
    shellSelector: typeof block.shell_selector === 'string' && block.shell_selector.trim()
      ? block.shell_selector.trim()
      : ISI_SCREENSHOT_SHELL_SELECTOR,
    wrapperSelector: typeof block.wrapper_selector === 'string' && block.wrapper_selector.trim()
      ? block.wrapper_selector.trim()
      : ISI_SCREENSHOT_WRAPPER_SELECTOR,
    scrollerSelector: typeof block.scroller_selector === 'string' && block.scroller_selector.trim()
      ? block.scroller_selector.trim()
      : ISI_SCREENSHOT_SCROLLER_SELECTOR,
    hideSelectors
  }
}

module.exports = {
  resolveScreenshotConfig
}
