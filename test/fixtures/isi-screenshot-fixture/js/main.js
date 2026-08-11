import '../common/isi.js'

window.addEventListener('DOMContentLoaded', () => {
  new window.ISI('scroller')

  // Frame markers for frame screenshot testing
  // banner-screenshot detects addLabel("frameN") patterns
  var timeline = {
    addLabel: function(name) {}
  }
  timeline.addLabel('frame1')
  timeline.addLabel('frame2')
  timeline.addLabel('frame3')
})
