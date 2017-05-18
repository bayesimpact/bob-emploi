import React from 'react'
import PropTypes from 'prop-types'


class CircularProgress extends React.Component {
  static propTypes = {
    periodMilliseconds: PropTypes.number,
    size: PropTypes.number,
    style: PropTypes.object,
    thickness: PropTypes.number,
  }
  static defaultProps = {
    periodMilliseconds: 1750,
    size: 80,
    thickness: 3.5,
  }

  state = {
    isWrapperRotated: false,
    scalePathStep: 0,
  }

  componentDidMount() {
    this.scalePath(0)
    this.rotateWrapper()
  }

  componentWillUnmount() {
    clearTimeout(this.scalePathTimer)
    clearTimeout(this.rotateWrapperTimer1)
    clearTimeout(this.rotateWrapperTimer2)
  }

  scalePath(step) {
    const {periodMilliseconds} = this.props
    this.setState({scalePathStep: step})
    this.scalePathTimer = setTimeout(
      () => this.scalePath((step + 1) % 3),
      step ? .4 * periodMilliseconds : .2 * periodMilliseconds)
  }

  rotateWrapper() {
    const {periodMilliseconds} = this.props
    this.setState({isWrapperRotated: false})

    this.rotateWrapperTimer1 = setTimeout(() => {
      this.setState({isWrapperRotated: true})
    }, 50)

    this.rotateWrapperTimer2 = setTimeout(
      () => this.rotateWrapper(),
      50 + periodMilliseconds * 5.7143)
  }

  render() {
    const {periodMilliseconds, size, thickness} = this.props
    const {isWrapperRotated, scalePathStep} = this.state
    const style = {
      // TODO: Use SKY_BLUE from `theme`. I did not get it to work when progress is imported
      // into `theme`. Seems to be some circular dependency issue.
      color: '#58bbfb',
      height: size,
      marginLeft: 'auto',
      marginRight: 'auto',
      position: 'relative',
      width: size,
      ...this.props.style,
    }
    const color = style.color
    const wrapperStyle = {
      display: 'inline-block',
      height: size,
      transform: `rotate(${isWrapperRotated ? '1800' : '0'}deg)`,
      transition: `all ${isWrapperRotated ? '10' : '0'}s linear`,
      width: size,
    }
    const getArcLength = fraction => fraction * Math.PI * (size - thickness)
    let strokeDasharray, strokeDashoffset, transitionDuration
    if (scalePathStep === 0) {
      strokeDasharray = `${getArcLength(0)}, ${getArcLength(1)}`
      strokeDashoffset = 0
      transitionDuration = '0'
    } else if (scalePathStep === 1) {
      strokeDasharray = `${getArcLength(0.7)}, ${getArcLength(1)}`
      strokeDashoffset = getArcLength(-0.3)
      transitionDuration = periodMilliseconds * .4
    } else {
      strokeDasharray = `${getArcLength(0.7)}, ${getArcLength(1)}`
      strokeDashoffset = getArcLength(-1)
      transitionDuration = periodMilliseconds * .4857
    }
    const pathStyle = {
      stroke: color,
      strokeDasharray,
      strokeDashoffset,
      strokeLinecap: 'round',
      transition: `all ${transitionDuration}ms ease-in-out`,
    }

    return <div style={style}>
      <div style={wrapperStyle}>
        <svg viewBox={`0 0 ${size} ${size}`}>
          <circle
              style={pathStyle}
              cx={size / 2} cy={size / 2}
              r={(size - thickness) / 2}
              strokeWidth={thickness}
              strokeMiterlimit="20" fill="none" />
        </svg>
      </div>
    </div>
  }
}


export {CircularProgress}
