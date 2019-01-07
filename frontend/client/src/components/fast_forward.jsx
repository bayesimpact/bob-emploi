import PropTypes from 'prop-types'
import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {ShortKey} from 'components/shortkey'


const maxDurationBetweenClickInARowMillisec = 500
const minClicksInARow = 8
const swipeMaxDurationMillisec = 400
const horizontalSwipeMaxYDelta = 100
const horizontalSwipeMinXDelta = 150


let mobileListener = null


// A listener for mobile fast forward:
// - it first listens for 5 clicks in a row to enable mobile fast-forwarding, then
// - trigger fast-forward action on left swipes.
class MobileFastForwardListener {

  constructor() {
    this.lastClickTime = 0
    this.forwardHandlers = []
    document.addEventListener('touchstart', this.countClicksInARow)
  }

  countClicksInARow = () => {
    const time = new Date().getTime()
    if (!this.lastClickTime || time > this.lastClickTime + maxDurationBetweenClickInARowMillisec) {
      this.numClicksInARow = 1
    } else {
      this.numClicksInARow += 1
      if (this.numClicksInARow >= minClicksInARow) {
        document.removeEventListener('touchstart', this.countClicksInARow)
        this.startTouchListening()
      }
    }
    this.lastClickTime = time
  }

  startTouchListening() {
    alert('Fast-Forward enabled')
    document.addEventListener('touchstart', this.handleTouchStart)
    document.addEventListener('touchmove', this.handleTouchMove)
    document.addEventListener('touchend', this.handleTouchEnd)
  }

  handleTouchStart = ({touches}) => {
    if (touches.length !== 1) {
      this.startTouch = {}
      return
    }
    this.startTouch = {
      time: new Date().getTime(),
      x: touches[0].pageX,
      y: touches[0].pageY,
    }
    this.endTouch = null
  }

  handleTouchMove = ({touches}) => {
    if (touches.length !== 1) {
      return
    }
    this.endTouch = {
      x: touches[0].pageX,
      y: touches[0].pageY,
    }
  }

  handleTouchEnd = event => {
    if (!this.endTouch || !this.startTouch) {
      this.startTouch = {}
      this.endTouch = null
      return
    }
    const {time, x, y} = this.startTouch
    if (!time || new Date().getTime() > time + swipeMaxDurationMillisec) {
      return
    }
    const {x: endX, y: endY} = this.endTouch
    if (Math.abs(y - endY) >= horizontalSwipeMaxYDelta) {
      return
    }
    if (!endX || endX >= x - horizontalSwipeMinXDelta) {
      return
    }
    // Run all the handler until one returns false (or undefined).
    this.forwardHandlers.find(listener => !listener(event))
  }

  add(handler) {
    this.forwardHandlers.unshift(handler)
  }

  remove(handler) {
    const handlerIndex = this.forwardHandlers.findIndex(h => h === handler)
    if (handlerIndex >= 0) {
      this.forwardHandlers.splice(handlerIndex, 1)
    }
  }
}


class FastForward extends React.Component {
  static propTypes = {
    onForward: PropTypes.func.isRequired,
  }

  componentDidMount() {
    if (!isMobileVersion) {
      return
    }
    if (!mobileListener) {
      mobileListener = new MobileFastForwardListener()
    }
    this.handler = () => {
      const {onForward} = this.props
      return onForward && onForward()
    }
    mobileListener.add(this.handler)
  }

  componentWillUnmount() {
    if (!isMobileVersion) {
      return
    }
    if (mobileListener && this.handler) {
      mobileListener.remove(this.handler)
    }
  }

  render() {
    return <ShortKey
      keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true}
      onKeyUp={this.props.onForward} />
  }
}


export {FastForward}
