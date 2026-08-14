/* global ISI */

"use strict"

class BannerBase {
  constructor() {
    this.timeline = { duration: () => 5 }
  }
}

window.initializeIsi = function (tl) {
  const isiOptions = {
    autoPlay: true,
    autoPlayStartDelay: (tl ? tl.duration() : 0) + 2,
    autoPlayTime: 150
  }
  return new ISI('isi-content', isiOptions)
}

window.BannerBase = BannerBase
