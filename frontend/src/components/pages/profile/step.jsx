import React from 'react'
import PropTypes from 'prop-types'
import _ from 'underscore'

import {Colors, Button, PaddedOnMobile} from 'components/theme'
import {ShortKey} from 'components/shortkey'

class ProfileUpdater {
  constructor(fieldNames, component, {profile}) {
    this.fieldNames_ = fieldNames
    this.requiredFields_ = Object.keys(fieldNames).filter(fieldName => fieldNames[fieldName])
    this.component_ = component

    this.component_.setState(_.pick(profile, Object.keys(fieldNames)))
  }

  isFormValid = () => {
    return _.all(this.requiredFields_.map(fieldname => this.component_.state[fieldname]))
  }

  handleSubmit = () => {
    this.component_.setState({isValidated: true})
    if (this.isFormValid()) {
      const fields = _.pick(this.component_.state, Object.keys(this.fieldNames_))
      this.component_.props.onSubmit(fields)
    }
  }

  handleBack = () => {
    const {onBack} = this.component_.props
    const fields = _.pick(this.component_.state, Object.keys(this.fieldNames_))
    onBack && onBack(fields)
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
    onNextButtonClick: PropTypes.func.isRequired,
    onPreviousButtonClick: PropTypes.func,
    stepNumber: PropTypes.number,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
    totalStepCount: PropTypes.number,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }
  static defaultProps = {
    title: 'Définir mon projet',
  }

  render() {
    const {children, explanation, fastForward, nextButtonContent, onPreviousButtonClick,
      onNextButtonClick, contentStyle, style, stepNumber, totalStepCount,
      isNextButtonDisabled, title} = this.props
    const {isMobileVersion} = this.context
    const stepStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      width: 945,
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
      color: '#575757',
      fontSize: 14,
      lineHeight: 1.4,
      marginTop: 10,
      textAlign: 'center',
    }
    const stepNumberStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 13,
      fontStyle: 11,
      fontWeight: 'bold',
      letterSpacing: 1.2,
      textAlign: 'center',
      textTransform: 'uppercase',
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
      padding: '13px 10px',
      width: 130,
    }
    const buttonStyle = isMobileVersion ? mobileButtonStyle : {}
    const isLastOnboardingStep = totalStepCount && totalStepCount === stepNumber
    return <div style={stepStyle}>
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={fastForward} />
      <PaddedOnMobile><div style={titleStyle}>{title}</div></PaddedOnMobile>
      {stepNumber && totalStepCount ? <div style={stepNumberStyle}>
        Étape {stepNumber} / {totalStepCount}
      </div> : null}
      {explanation ? <div style={explanationStyle}>{explanation}</div> : null}
      <div style={containerStyle}>
        {children}
      </div>
      <div style={navigationStyle}>
        {onPreviousButtonClick ? <Button
          type="back" onClick={onPreviousButtonClick} style={{...buttonStyle, marginRight: 20}}>
          Précédent
        </Button> : null}
        <Button
          type="validation"
          onClick={onNextButtonClick}
          disabled={isNextButtonDisabled}
          style={buttonStyle}>
          {nextButtonContent || (isLastOnboardingStep ? 'Créer' : 'Suivant')}
        </Button>
      </div>
    </div>
  }
}


export {Step, ProfileUpdater}
