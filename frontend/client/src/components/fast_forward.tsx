import PropTypes from 'prop-types'
import React from 'react'
import {Redirect} from 'react-router-dom'

import {isMobileVersion} from 'components/mobile'
import {ShortKey} from 'components/shortkey'


const maxDurationBetweenClickInARowMillisec = 500
const minClicksInARow = 8
const swipeMaxDurationMillisec = 400
const horizontalSwipeMaxYDelta = 100
const horizontalSwipeMinXDelta = 150


let mobileListener: MobileFastForwardListener|undefined


// A listener for mobile fast forward:
// - it first listens for 5 clicks in a row to enable mobile fast-forwarding, then
// - trigger fast-forward action on left swipes.
class MobileFastForwardListener {

  public constructor() {
    this.lastClickTime = 0
    this.forwardHandlers = []
    document.addEventListener('touchstart', this.countClicksInARow)
  }

  private endTouch: {
    readonly x: number
    readonly y: number
  } | undefined

  private forwardHandlers: (() => void)[]

  private lastClickTime: number

  private numClicksInARow = 0

  private startTouch: {
    readonly time: number
    readonly x: number
    readonly y: number
  } | undefined

  private countClicksInARow = (): void => {
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

  private startTouchListening(): void {
    alert('Fast-Forward enabled')
    document.addEventListener('touchstart', this.handleTouchStart)
    document.addEventListener('touchmove', this.handleTouchMove)
    document.addEventListener('touchend', this.handleTouchEnd)
  }

  private handleTouchStart = ({touches}: TouchEvent): void => {
    if (touches.length !== 1) {
      this.startTouch = undefined
      return
    }
    this.startTouch = {
      time: new Date().getTime(),
      x: touches[0].pageX,
      y: touches[0].pageY,
    }
    this.endTouch = undefined
  }

  private handleTouchMove = ({touches}: TouchEvent): void => {
    if (touches.length !== 1) {
      return
    }
    this.endTouch = {
      x: touches[0].pageX,
      y: touches[0].pageY,
    }
  }

  private handleTouchEnd = (): void => {
    if (!this.endTouch || !this.startTouch) {
      this.startTouch = undefined
      this.endTouch = undefined
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
    const firstHandler = this.forwardHandlers[0]
    firstHandler && firstHandler()
  }

  public add(handler: () => void): void {
    this.forwardHandlers.unshift(handler)
  }

  public remove(handler: () => void): void {
    const handlerIndex = this.forwardHandlers.findIndex((h): boolean => h === handler)
    if (handlerIndex >= 0) {
      this.forwardHandlers.splice(handlerIndex, 1)
    }
  }
}


interface LinkFastForwardProps {
  onForward?: () => void
  to: string
}

interface ActionFastForwardProps {
  onForward: () => void
  to?: string
}

type FastForwardProps = LinkFastForwardProps | ActionFastForwardProps

class FastForward extends React.PureComponent<FastForwardProps, {forwarded: boolean}> {
  // TODO(cyrille): Fix this when both are set.
  public static propTypes = {
    onForward: PropTypes.func,
    to: PropTypes.string,
  }

  public state = {
    forwarded: false,
  }

  public componentDidMount(): void {
    if (!isMobileVersion) {
      return
    }
    if (!mobileListener) {
      mobileListener = new MobileFastForwardListener()
    }
    this.handler = (): void => this.props.onForward?.()
    mobileListener.add(this.handler)
  }

  public componentWillUnmount(): void {
    if (!isMobileVersion) {
      return
    }
    if (mobileListener && this.handler) {
      mobileListener.remove(this.handler)
    }
  }

  private handler?: () => void

  private onForward = (): void => {
    this.props.onForward?.()
    this.setState({forwarded: true})
  }

  public render(): React.ReactNode {
    const {to} = this.props
    // TODO(cyrille): Change to functional component, and use useHistory hook from react-router.
    if (this.state.forwarded && typeof to !== 'undefined') {
      return <Redirect to={to} push={true} />
    }
    return <ShortKey
      keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true}
      onKeyUp={this.onForward} />
  }
}


export {FastForward}
