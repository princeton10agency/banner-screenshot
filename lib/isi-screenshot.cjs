const { pathToFileURL } = require('url')
const path = require('path')

function getIsiInitScript() {
  return () => {
    const state = { instances: [] }

    Object.defineProperty(window, '__bannerBuildIsiScreenshotState', {
      configurable: true,
      enumerable: false,
      value: state
    })

    const wrapCtor = (Ctor) => {
      if (typeof Ctor !== 'function') {
        return Ctor
      }

      const wrapped = new Proxy(Ctor, {
        construct(target, args, newTarget) {
          const instance = Reflect.construct(target, args, newTarget)
          state.instances.push(instance)
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
      } catch (_error) {
        // Some constructors do not allow prototype reassignment
      }

      return wrapped
    }

    let currentCtor = null
    Object.defineProperty(window, 'ISI', {
      configurable: true,
      enumerable: true,
      get() {
        return currentCtor
      },
      set(value) {
        currentCtor = wrapCtor(value)
      }
    })
  }
}

async function settleIsiInstances(page) {
  await page.evaluate(() => {
    const state = window.__bannerBuildIsiScreenshotState
    const instances = state && Array.isArray(state.instances) ? state.instances : []

    for (const instance of instances) {
      try {
        if (instance.autoplayID != null) {
          window.cancelAnimationFrame(instance.autoplayID)
          instance.autoplayID = null
        }
      } catch (_error) { /* ignore */ }

      try {
        if (instance.startDelayTimeout != null) {
          clearTimeout(instance.startDelayTimeout)
          instance.startDelayTimeout = null
        }
      } catch (_error) { /* ignore */ }

      try {
        if (instance.updatePositionID != null) {
          clearTimeout(instance.updatePositionID)
          instance.updatePositionID = null
        }
      } catch (_error) { /* ignore */ }

      try {
        if (instance.isiOptions && typeof instance.isiOptions === 'object') {
          instance.isiOptions.autoPlay = false
        }
      } catch (_error) { /* ignore */ }

      try {
        if (Object.prototype.hasOwnProperty.call(instance, 'scrollerY')) {
          instance.scrollerY = 0
        }
      } catch (_error) { /* ignore */ }

      try {
        if (typeof instance.updatePosition === 'function') {
          instance.updatePosition(0)
        }
      } catch (_error) { /* ignore */ }

      try {
        if (typeof instance.updatePositionRender === 'function') {
          instance.updatePositionRender()
        }
      } catch (_error) { /* ignore */ }
    }
  })
}

async function expandIsiForScreenshot(page, settings) {
  return page.evaluate((input) => {
    const captureEl = document.querySelector(input.captureSelector)
    const shellEl = document.querySelector(input.shellSelector)
    const wrapperEl = document.querySelector(input.wrapperSelector)
    const scrollerEl = document.querySelector(input.scrollerSelector)
    const creativeEl = document.querySelector('#creative')
    const borderEl = document.querySelector('#border')

    if (!captureEl) {
      throw new Error(`Missing ISI capture element: ${input.captureSelector}`)
    }
    if (!shellEl) {
      throw new Error(`Missing ISI shell element: ${input.shellSelector}`)
    }
    if (!wrapperEl) {
      throw new Error(`Missing ISI wrapper element: ${input.wrapperSelector}`)
    }
    if (!scrollerEl) {
      throw new Error(`Missing ISI scroller element: ${input.scrollerSelector}`)
    }

    const hideSelectors = Array.isArray(input.hideSelectors) ? input.hideSelectors : []
    for (const selector of hideSelectors) {
      if (!selector) continue
      const elements = document.querySelectorAll(selector)
      for (const element of elements) {
        element.setAttribute('data-banner-build-hidden', 'true')
        element.style.setProperty('display', 'none', 'important')
        element.style.setProperty('visibility', 'hidden', 'important')
        element.style.setProperty('pointer-events', 'none', 'important')
      }
    }

    document.documentElement.style.setProperty('overflow', 'visible', 'important')
    document.body.style.setProperty('overflow', 'visible', 'important')

    const height = Math.ceil(scrollerEl.scrollHeight)
    const width = Math.ceil(captureEl.getBoundingClientRect().width)

    const lock = (element) => {
      element.style.setProperty('position', 'relative', 'important')
      element.style.setProperty('height', 'auto', 'important')
      element.style.setProperty('min-height', `${height}px`, 'important')
      element.style.setProperty('overflow', 'visible', 'important')
      element.style.setProperty('transition', 'none', 'important')
      element.style.setProperty('transform', 'none', 'important')
      element.style.setProperty('width', `${width}px`, 'important')
      element.style.setProperty('max-width', `${width}px`, 'important')
    }

    lock(captureEl)
    lock(shellEl)
    lock(wrapperEl)
    lock(scrollerEl)

    captureEl.style.setProperty('top', '0', 'important')

    if (creativeEl) {
      creativeEl.style.setProperty('overflow', 'unset', 'important')
      creativeEl.style.setProperty('height', `${height}px`, 'important')
    }

    if (borderEl) {
      borderEl.style.setProperty('border', 'unset', 'important')
    }

    wrapperEl.style.setProperty('padding-bottom', '0', 'important')
    wrapperEl.style.setProperty('box-shadow', 'none', 'important')
    scrollerEl.style.setProperty('padding-bottom', '0', 'important')
    scrollerEl.style.setProperty('margin-bottom', '0', 'important')
    captureEl.style.setProperty('height', `${height}px`, 'important')

    return {
      width,
      height
    }
  }, settings)
}

async function waitForPageReady(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
  })
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100)))
}

async function captureIsiScreenshot(page, variantDir, settings, outputPath) {
  await page.goto(pathToFileURL(path.join(variantDir, 'index.html')).href, {
    waitUntil: 'load'
  })

  await waitForPageReady(page)
  await settleIsiInstances(page)
  await expandIsiForScreenshot(page, settings)
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)))

  const capture = page.locator(settings.captureSelector)
  await capture.screenshot({
    path: outputPath,
    animations: 'disabled'
  })
}

module.exports = {
  getIsiInitScript,
  settleIsiInstances,
  expandIsiForScreenshot,
  waitForPageReady,
  captureIsiScreenshot
}
