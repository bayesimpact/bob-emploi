import React from 'react'

import {Colors, SmoothTransitions} from 'components/theme'

class DailyGoal extends React.Component {
  static propTypes = {
    denominator: React.PropTypes.number.isRequired,
    isCreatingActionPlanForTheFirstTime: React.PropTypes.bool,
    isCreatingActionPlanShown: React.PropTypes.bool,
    isFinishDashboardShown: React.PropTypes.bool,
    numerator: React.PropTypes.number.isRequired,
  }

  renderActionCount = () => {
    const {denominator, numerator} = this.props
    const maybeS = (denominator - numerator) > 1 ? 's' : ''
    return <strong>
      action{maybeS} restante{maybeS}
    </strong>
  }

  renderCelebrationText = () => {
    return <div>
      <strong>Félicitations !</strong><br />
      Vous avez atteint votre objectif.
    </div>
  }

  render() {
    const {denominator, isCreatingActionPlanShown, isCreatingActionPlanForTheFirstTime,
           isFinishDashboardShown, numerator} = this.props
    const circleStyle = {
      alignItems: 'center',
      display: 'flex',
      height: 122,
      justifyContent: 'center',
      margin: 'auto',
      width: 122,
      zIndex: 0,
    }
    const textStyle = {
      color: Colors.SLATE,
      fontSize: 13,
      lineHeight: 1.54,
      marginTop: 10,
      textAlign: 'center',
    }
    return <div style={SmoothTransitions}>
      <TransitionBetweenChildren>
        {isCreatingActionPlanShown ?
          isCreatingActionPlanForTheFirstTime ?
            <img
               key="actionplan-image"
               src={require('images/day-1-picto.svg')} style={circleStyle} />
            :
            <img
               key="actionplan-image"
               src={require('images/jourx-ico.svg')} style={circleStyle} />
          :
          isFinishDashboardShown ?
            <BouncyImage
                key="finish-image"
                src={require('images/finish-picto.svg')} style={circleStyle} />
            :
            <ProgressCircle
                key="progress-circle"
                denominator={denominator} numerator={numerator} size={circleStyle.height} />}
      </TransitionBetweenChildren>
      <div style={textStyle}>
        {isCreatingActionPlanShown ? null : isFinishDashboardShown ?
          this.renderCelebrationText() :
          this.renderActionCount()}
      </div>
    </div>
  }
}


class ProgressCircle extends React.Component {
  static propTypes = {
    denominator: React.PropTypes.number.isRequired,
    numerator: React.PropTypes.number.isRequired,
    size: React.PropTypes.number.isRequired,
  }

  render() {
    const {size} = this.props
    const strokeWidth = 4
    const radius = size / 2 - strokeWidth + 2
    const {denominator, numerator} = this.props
    const circumference = Math.PI * radius * 2
    const progress = denominator ? (numerator / denominator) : 1
    const offset = circumference - (circumference * progress)
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      border: 'none',
      borderRadius: '50%',
      color: Colors.COOL_GREY,
      display: 'flex',
      height: size,
      justifyContent: 'center',
      position: 'relative',
      width: size,
    }
    const svgStyle = {
      left: 0,
      position: 'absolute',
      top: 0,
      // Rotation to make the dashoffset start at the top of the circle.
      transform: 'rotate(270deg)',
    }
    const circleStyle = {
      fill: 'transparent',
      stroke: Colors.LIGHT_GREY,
      strokeDasharray: circumference,
      strokeWidth,
      transition: 'stroke-dashoffset 0.8s cubic-bezier(0.36, 0.8, 0.52, 0.9)',
    }
    const overlayCircleStyle = {
      ...circleStyle,
      stroke: Colors.GREENISH_TEAL,
      strokeDashoffset: offset,
    }
    const textStyle = {
      color: Colors.SLATE,
      fill: Colors.COOL_GREY,
      fontFamily: 'GTWalsheim',
      fontSize: 68,
      fontWeight: 500,
      marginTop: 12,
    }
    return <div style={style}>
      <svg id="svg" width={size} height={size} style={svgStyle}>
        <circle style={circleStyle} r={radius} cx={size/2} cy={size/2} />
        <circle style={overlayCircleStyle} r={radius} cx={size/2} cy={size/2} />
      </svg>
      <div style={textStyle}>{denominator - numerator}</div>
    </div>
  }
}


class BouncyImage extends React.Component {
  static propTypes = {
    src: React.PropTypes.string.isRequired,
    style: React.PropTypes.object,
  }

  state = {
    // Easter egg.
    bounces: 0,
    isBouncing: false,
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  bounce = () => {
    this.setState({bounces: this.state.bounces + 1, isBouncing: true})
    this.timeout = setTimeout(() => this.setState({isBouncing: false}), 100)
  }

  render() {
    const {src, style} = this.props
    const {bounces, isBouncing} = this.state
    let scale = isBouncing ? 1.2 : 1
    if (bounces >= 5 && isBouncing) {
      scale = 3
    }
    if (bounces >= 10) {
      scale = 0
    }
    const finishPictoStyle = {
      ...style,
      cursor: 'pointer',
      transform: `scale(${scale}, ${scale})`,
      transition: 'ease-out 100ms',
    }
    if (bounces === 9) {
      finishPictoStyle.transform += ' rotateY(0deg)'
    }
    if (bounces >= 10) {
      finishPictoStyle.transform += ' rotateY(720deg)'
      finishPictoStyle.transition = 'ease-out 1s'
    }
    return <img
        src={src}
        style={finishPictoStyle}
        onClick={this.bounce} />
  }
}


class TransitionBetweenChildren extends React.Component {
  static propTypes = {
    children: React.PropTypes.element,
    transitionDurationMillisec: React.PropTypes.number,
  }
  static defaultProps = {
    transitionDurationMillisec: 800,
  }

  componentWillMount() {
    const {children} = this.props
    if (!(children && children.key)) {
      throw 'Children element needs a `key` for transition.'
    }
    this.setState({
      isFadingIn: false,
      isFadingOut: false,
      isInTransition: false,
      nodeShown: children,
    })
    // The state will be modified like this during a transition:
    // isFadingIn isFadingOut nodeShown
    //   false       false       1
    //   false       true        1
    // ...
    //   true        false       2
    //   false       false       2
    // ...
    // end
  }

  componentWillReceiveProps(nextProps) {
    if (!(nextProps.children && nextProps.children.key)) {
      throw 'Children element needs a `key` for transition.'
    }
    if (nextProps.children.key === this.props.children.key) {
      this.setState({nodeShown: nextProps.children})
      return
    }
    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.setState({
      isInTransition: true,
      nextNode: nextProps.children,
    }, this.startFadingOut)
  }

  startFadingOut = () => {
    this.setState({isFadingOut: true})
    this.timeout = setTimeout(this.startFadingIn, this.props.transitionDurationMillisec / 2)
  }

  startFadingIn = () => {
    this.setState({
      isFadingIn: true,
      isFadingOut: false,
      nodeShown: this.state.nextNode,
    }, this.endFadingIn)
  }

  endFadingIn = () => {
    this.setState({
      isFadingIn: false,
      nextNode: null,
    })
    this.timeout = setTimeout(this.endTransition, this.props.transitionDurationMillisec / 2)
  }

  endTransition = () => {
    this.setState({isInTransition: false})
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  render() {
    const {isFadingIn, isFadingOut, nodeShown} = this.state
    const scale = isFadingOut || isFadingIn ? 0 : 1
    const style = {
      opacity: isFadingOut || isFadingIn ? 0 : 1,
      transform: `scale(${scale}, ${scale})`,
      transformOrigin: 'center center',
      transition: `ease-in ${this.props.transitionDurationMillisec / 2}ms`,
    }
    return <div style={style}>
      {nodeShown}
    </div>
  }
}


export {DailyGoal}
