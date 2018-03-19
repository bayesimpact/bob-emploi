import pick from 'lodash/pick'
import React from 'react'
import PropTypes from 'prop-types'

import {FastForward} from 'components/fast_forward'
import {Colors, Button, PaddedOnMobile, PercentBar} from 'components/theme'

class ProfileUpdater {
  constructor(fieldNames, component, {profile}) {
    this.fieldNames_ = fieldNames
    this.requiredFields_ = Object.keys(fieldNames).filter(fieldName => fieldNames[fieldName])
    this.component_ = component

    this.component_.setState(pick(profile, Object.keys(fieldNames)))
  }

  isFormValid = () => {
    return this.requiredFields_.every(fieldname => this.component_.state[fieldname])
  }

  handleSubmit = () => {
    this.component_.setState({isValidated: true})
    if (this.isFormValid()) {
      const fields = pick(this.component_.state, Object.keys(this.fieldNames_))
      this.component_.props.onSubmit(fields)
    }
  }

  getBackHandler = () => {
    const {onBack} = this.component_.props
    if (!onBack) {
      return null
    }
    return () => {
      const fields = pick(this.component_.state, Object.keys(this.fieldNames_))
      onBack(fields)
    }
  }

  handleChange = field => value => {
    this.component_.setState({[field]: value})
  }
}


class Step extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    contentStyle: PropTypes.object,
    explanation: PropTypes.node,
    fastForward: PropTypes.func.isRequired,
    isNextButtonDisabled: PropTypes.bool,
    nextButtonContent: PropTypes.node,
    onNextButtonClick: PropTypes.func,
    onPreviousButtonClick: PropTypes.func,
    stepNumber: PropTypes.number,
    style: PropTypes.object,
    title: PropTypes.string,
    totalStepCount: PropTypes.number,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {children, explanation, fastForward, nextButtonContent, onPreviousButtonClick,
      onNextButtonClick, contentStyle, style, stepNumber, totalStepCount,
      isNextButtonDisabled, title} = this.props
    const {isMobileVersion} = this.context
    const stepStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    const titleStyle = {
      color: Colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.3,
      marginTop: 40,
      textAlign: 'center',
    }
    const explanationStyle = {
      color: Colors.GREYISH_BROWN,
      fontSize: 14,
      lineHeight: 1.4,
      marginTop: 10,
      textAlign: 'center',
    }
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      marginTop: 33,
      maxWidth: 480,
      padding: '0 20px',
      ...contentStyle,
    }
    const navigationStyle = {
      display: 'flex',
      marginBottom: isMobileVersion ? 20 : 40,
      marginTop: 15,
    }
    const mobileButtonStyle = {
      minWidth: 130,
      padding: '13px 16px',
    }
    const buttonStyle = isMobileVersion ? mobileButtonStyle : {}
    const isLastOnboardingStep = totalStepCount && totalStepCount === stepNumber
    return <div style={stepStyle}>
      <FastForward onForward={fastForward} />
      {title ? <PaddedOnMobile><div style={titleStyle}>{title}</div></PaddedOnMobile> : null}
      {stepNumber && totalStepCount ? <PercentBar
        color={Colors.BOB_BLUE}
        height={15}
        percent={Math.round(100 * (stepNumber - .5) / totalStepCount)}
        showPercent={false}
        style={{marginTop: 10, width: '90%'}}
      /> : null
      }
      {explanation ? <div style={explanationStyle}>{explanation}</div> : null}
      <div style={containerStyle}>
        {children}
      </div>
      <div style={navigationStyle}>
        {onPreviousButtonClick ? <Button
          type="back" onClick={onPreviousButtonClick} style={{...buttonStyle, marginRight: 20}}
          isRound={true}>
          Précédent
        </Button> : null}
        {onNextButtonClick ? <Button
          isRound={true}
          onClick={onNextButtonClick}
          disabled={isNextButtonDisabled}
          style={buttonStyle}>
          {nextButtonContent || (isLastOnboardingStep ? 'Terminer le questionnaire' : 'Suivant')}
        </Button> : null}
      </div>
    </div>
  }
}


export {Step, ProfileUpdater}
