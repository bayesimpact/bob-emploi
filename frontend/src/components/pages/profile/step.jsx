import React from 'react'
import _ from 'underscore'

import {RoundButton} from 'components/theme'
import {ShortKey} from 'components/shortkey'
import {USER_PROFILE_SHAPE} from 'store/user'


class ProfileStepBaseClass extends React.Component {
  static propTypes = {
    fieldnames: React.PropTypes.object,
    onBack: React.PropTypes.func,
    onSubmit: React.PropTypes.func.isRequired,
    profile: USER_PROFILE_SHAPE,
  }

  constructor(props) {
    super(props)
    this.fieldnames = props.fieldnames
    this.state = _.pick(props.profile, Object.keys(this.fieldnames))
  }

  isFormValid = () => {
    const requiredFields = Object.keys(this.fieldnames).
      filter(fieldname => this.fieldnames[fieldname])
    return _.all(requiredFields.map(fieldname => this.state[fieldname]))
  }

  handleSubmit = () => {
    this.setState({isValidated: true})
    if (this.isFormValid()) {
      const fields = _.pick(this.state, Object.keys(this.fieldnames))
      this.props.onSubmit(fields)
    }
  }

  handleBack = () => {
    const {onBack} = this.props
    const fields = _.pick(this.state, Object.keys(this.fieldnames))
    onBack && onBack(fields)
  }

  handleChange = field => value => {
    this.setState({[field]: value})
  }
}


class ProfileStep extends React.Component {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    contentStyle: React.PropTypes.object,
    explanation: React.PropTypes.node,
    fastForward: React.PropTypes.func.isRequired,
    isNextButtonDisabled: React.PropTypes.bool,
    nextButtonContent: React.PropTypes.node,
    onNextButtonClick: React.PropTypes.func.isRequired,
    onPreviousButtonClick: React.PropTypes.func,
    style: React.PropTypes.object,
    title: React.PropTypes.string.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {children, fastForward, nextButtonContent, onPreviousButtonClick,
           onNextButtonClick, contentStyle, style, title, explanation,
           isNextButtonDisabled} = this.props
    const {isMobileVersion} = this.context
    const stepStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      width: isMobileVersion ? 'initial' : 945,
      ...style,
    }
    const titleStyle = {
      color: '#2c3449',
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.6,
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
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      marginTop: 40,
      padding: '0 50px',
      width: isMobileVersion ? 'initial' : 480,
      ...contentStyle,
    }
    return <div style={stepStyle}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={fastForward} />
      <div style={titleStyle}>{title}</div>
      {explanation ? <div style={explanationStyle}>{explanation}</div> : null}
      <div style={containerStyle}>
        {children}
      </div>
      <div style={{display: 'flex', marginBottom: 40, marginTop: 70}}>
        {onPreviousButtonClick ? <RoundButton
            type="back" onClick={onPreviousButtonClick} style={{marginRight: 20}}>
          Précédent
        </RoundButton> : null}
        <RoundButton type="validation" onClick={onNextButtonClick} disabled={isNextButtonDisabled}>
          {nextButtonContent || 'Suivant'}
        </RoundButton>
      </div>
    </div>
  }
}


export {ProfileStep, ProfileStepBaseClass}
