import React from 'react'
import PropTypes from 'prop-types'
import VisibilitySensor from 'react-visibility-sensor'

import {Colors, GrowingNumber, Icon} from 'components/theme'

import {ResumeAdvicePageContent} from './improve_success_rate'


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {advice} = this.props
    const {isMobileVersion} = this.context

    // If we have the num_interviews_increase from the advice, we print it,
    // otherwise we say 2 times more as discussed with John.
    let interviewMultiplier =
        advice.improveSuccessRateData &&
        advice.improveSuccessRateData.numInterviewsIncrease &&
        Math.round(advice.improveSuccessRateData.numInterviewsIncrease) || 2
    if (interviewMultiplier > 5) {
      interviewMultiplier = 5
    }

    const style = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
    }

    return <div style={style}>
      <div style={{flex: 1}}>
        Votre profil mérite
        <div style={{fontSize: 30, marginBottom: 10}}>
          <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>
            <GrowingNumber number={interviewMultiplier} />x
          </strong> plus d'entretiens
        </div>
      </div>

      {isMobileVersion ? null  : <MultiplierChart multiplier={interviewMultiplier} />}
    </div>
  }
}


// TODO(pascal): Factorize with network's JobOriginChart.
class MultiplierChart extends React.Component {
  static propTypes = {
    // Duration of appearance of one bar.
    barEntranceDurationMillisec: PropTypes.number.isRequired,
    // Total duration of appearance animation.
    entranceAnimationDurationMillisec: PropTypes.number.isRequired,
    multiplier: PropTypes.number.isRequired,
  }
  static defaultProps = {
    barEntranceDurationMillisec: 500,
    entranceAnimationDurationMillisec: 500,
  }

  componentWillMount() {
    const {multiplier} = this.props
    this.graphData = [
      {percentage: 100 / multiplier, text: this.renderArrows()},
      {isHighlighted: true, percentage: 100},
    ]
    this.setState({numBarToShow: 0, shouldAnimateOnVisible: true})
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  startAppearanceAnimation = isVisible => {
    if (!isVisible) {
      return
    }
    this.setState({shouldAnimateOnVisible: false})
    this.showNextBar(0)
  }

  showNextBar(numBarToShow) {
    if (numBarToShow > this.graphData.length) {
      return
    }
    this.setState({numBarShown: numBarToShow})
    this.timeout = setTimeout(
      () => this.showNextBar(numBarToShow + 1),
      this.props.entranceAnimationDurationMillisec / this.graphData.length,
    )
  }

  renderArrows() {
    return <span style={{color: Colors.SKY_BLUE, fontSize: 35}}>
      <Icon name="arrow-up" />
      <br />
      <Icon name="arrow-up" />
    </span>
  }

  renderBar({isHighlighted, percentage, text}, indexBar) {
    const {barEntranceDurationMillisec} = this.props
    const isShown = indexBar < this.state.numBarShown
    const transition =
      `all ${barEntranceDurationMillisec}ms cubic-bezier(0.23, 1, 0.32, 1)`
    const style = {
      display: 'inline-block',
      textAlign: 'center',
      verticalAlign: 'top',
      width: 100,
    }
    const barAndTextStyle = {
      borderBottom: '1px solid',
      borderColor: Colors.SILVER,
      display: 'flex',
      flexDirection: 'column',
      height: 140,
      justifyContent: 'flex-end',
      position: 'relative',
    }
    const coloredBarStyle = {
      backgroundColor: isHighlighted ? Colors.SKY_BLUE : Colors.SILVER,
      height: isShown ? `${percentage}%` : 0,
      margin: '0 auto',
      transition,
      width: 65,
    }
    return <div style={style} key={indexBar}>
      <div style={barAndTextStyle}>
        {text}
        <div style={coloredBarStyle}></div>
      </div>
    </div>
  }

  render() {
    const graphStyle = {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 0,
    }
    return <div style={graphStyle}>
      <VisibilitySensor
          active={this.state.shouldAnimateOnVisible} intervalDelay={250}
          onChange={this.startAppearanceAnimation} />
      <div>
        {this.graphData.map((barData, indexBar) => this.renderBar(barData, indexBar))}
      </div>
    </div>
  }
}


export default {AdvicePageContent: ResumeAdvicePageContent, FullAdviceCard}
