/* global ISI */
window.ISI = function (el, options) {
  this.isiOptions = options || {}
  this.scrollerY = 0
  this.startDelayTimeout = null
  this.autoplayID = null
  this.updatePositionID = null
  this.updatePosition = function () {}
  this.updatePositionRender = function () {}
}
