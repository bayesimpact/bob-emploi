import omit from 'lodash/omit'
import PropTypes from 'prop-types'
import React from 'react'

import {Colors} from 'components/theme'


// A list of control points to define the wave shape: each list of points
// define a different wave in time. For a wave, each control point is defined
// by a 3 points with the same y value, the middle one is the actual point and
// the two others are for the curvatures on the left and on the right using the
// Bezier extrapolation of semi-tangents.
const allWaveControlPoints = [
  [
    {x: [132, 225, 319], y: 431},
    {x: [383, 613, 842], y: 491},
    {x: [838, 1145, 1357], y: 364},
    {x: [1370, 1460, 1550], y: 236},
  ],
  [
    {x: [110, 266, 421], y: 452},
    {x: [454, 688, 922], y: 520},
    {x: [1118, 1209, 1367], y: 336},
    {x: [1371, 1461, 1550], y: 236},
  ],
  [
    {x: [164, 359, 554], y: 548},
    {x: [739, 875, 1011], y: 382},
    {x: [1018, 1209, 1366], y: 464},
    {x: [1371, 1461, 1550], y: 236},
  ],
  [
    {x: [194, 389, 584], y: 548},
    {x: [769, 905, 1041], y: 302},
    {x: [1048, 1239, 1396], y: 454},
    {x: [1371, 1461, 1550], y: 236},
  ],
  [
    {x: [240, 354, 469], y: 418},
    {x: [517, 720, 924], y: 478},
    {x: [1162, 1299, 1436], y: 152},
    {x: [1371, 1461, 1550], y: 236},
  ],
]


class Waves extends React.Component {
  static propTypes = {
    numPeriodsPerDrift: PropTypes.number,
    periodMillisec: PropTypes.number,
    randomFunc: PropTypes.func,
  }

  static defaultProps = {
    numPeriodsPerDrift: 10,
    periodMillisec: 7000,
    randomFunc: Math.random,
  }

  state = this.getNextState(-1, 0)

  componentWillMount() {
    const {periodMillisec} = this.props
    this.interval = setInterval(
      this.progressTime,
      // See documentation of getNextState for understanding the / 5.
      periodMillisec / 5,
    )
  }

  componentDidMount() {
    this.progressTime()
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  progressTime = () => {
    this.setState(({periodInDrift, time}) => this.getNextState(time, periodInDrift))
  }

  // The wave animations is divided in two pieces taking 40% and 60% of the
  // whole period. So we divide the period in 5 pieces and switch state at time
  // 0 and time 2. This function is called a first time with a specific -1
  // value to setup the initial waves.
  //
  // There is also a drift moving control points. This happens in n periods.
  // After n periods, we bring back all the control points as before the drift
  // with a 0ms transition.
  getNextState(time, periodInDrift) {
    const {numPeriodsPerDrift} = this.props
    if (time < 0) {
      return {
        ...this.getWaveState(2, 0),
        periodInDrift: 0,
        time: 4,
      }
    }
    const nextTime = (time + 1) % 5
    const nextPeriodInDrift = nextTime === 0 ?
      (periodInDrift + 1) % numPeriodsPerDrift : periodInDrift
    const drift = (periodInDrift + time / 5) / numPeriodsPerDrift * 2
    return {
      ...this.getWaveState(nextTime, drift <= 1 ? drift : (2 - drift)),
      periodInDrift: nextPeriodInDrift,
      time: nextTime,
    }
  }

  getWaveState(time, drift) {
    const {randomFunc} = this.props
    if (time === 0) {
      return {
        transition: .4,
        wave1: {
          opacity: 1,
          wavePath: this.renderWavePath(20, drift),
        },
        wave2: {
          delay: .1,
          opacity: .5,
          wavePath: this.renderWavePath(50 + 20 * randomFunc(), drift),
        },
        wave3: {
          delay: .15,
          opacity: .2,
          wavePath: this.renderWavePath(100 + 20 * randomFunc(), drift),
        },
      }
    }
    if (time === 2) {
      return {
        transition: .6,
        wave1: {
          opacity: 1,
          wavePath: this.renderWavePath(-20, drift),
        },
        wave2: {
          opacity: .5,
          wavePath: this.renderWavePath(-20, drift),
        },
        wave3: {
          opacity: 0,
          wavePath: this.renderWavePath(-20, drift),
        },
      }
    }
    return {}
  }

  getControlPoints(drift) {
    const driftIndex = drift * allWaveControlPoints.length
    const bWeight = driftIndex - Math.floor(driftIndex)
    const controlPointsA =
      allWaveControlPoints[Math.floor(driftIndex) % allWaveControlPoints.length]
    const controlPointsB =
      allWaveControlPoints[Math.floor(driftIndex + 1) % allWaveControlPoints.length]
    const interpolate = (a, b) => bWeight * b + (1 - bWeight) * a
    return controlPointsA.map((controlPointA, index) => {
      const controlPointB = controlPointsB[index]
      return {
        x: controlPointA.x.map((x, index) => interpolate(x, controlPointB.x[index])),
        y: interpolate(controlPointA.y, controlPointB.y),
      }
    })
  }

  renderWavePath(amplitude, drift) {
    const {randomFunc} = this.props
    const waveControlPoints = this.getControlPoints(drift)
    const wavePath = waveControlPoints.map(({x, y}) => {
      const deltaX = Math.round(randomFunc() * 40 - 20)
      const deltaY = Math.round(amplitude * ((randomFunc() * .6 || .3) + .7))
      return `${x.map(controlPointX => `${controlPointX + deltaX},${y + deltaY}`).join(' ')}`
    }).join(' ')
    return `M-300,${520 + amplitude} C-238,${520 + amplitude} ${wavePath} 1600,0
      1440,0 L1,36 L0,607 Z`
  }

  renderWave(transition, {delay, opacity, wavePath}) {
    const {periodMillisec} = this.props
    const style = {
      transitionDelay: `${(delay || 0) * periodMillisec}ms`,
      transitionDuration: `${((transition || 0) - (delay || 0)) * periodMillisec}ms`,
      transitionTimingFunction: 'ease-in-out',
    }
    return <path d={wavePath} fillOpacity={opacity} style={style} />
  }

  render() {
    const {transition, wave1, wave2, wave3} = this.state
    return <svg
      {...omit(this.props, ['numPeriodsPerDrift', 'periodMillisec', 'randomFunc'])}
      viewBox="0 0 1400 566" preserveAspectRatio="none">
      <g transform="translate(-20, -146)" fill={Colors.BOB_BLUE}>
        {this.renderWave(transition, wave1)}
        {this.renderWave(transition, wave2)}
        {this.renderWave(transition, wave3)}
      </g>
    </svg>
  }
}

export {Waves}
