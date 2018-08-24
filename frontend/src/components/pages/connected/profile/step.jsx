import _omit from 'lodash/omit'
import _pick from 'lodash/pick'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DIAGNOSE_ONBOARDING} from 'store/actions'

import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Button, PaddedOnMobile, PercentBar} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'


class ComponentProfileUpdater {
  constructor(fieldNames, component) {
    this.fieldNames_ = fieldNames
    this.requiredFields_ = Object.keys(fieldNames).filter(fieldName => fieldNames[fieldName])
    this.component_ = component
  }

  isFormValid = () => {
    return this.requiredFields_.every(fieldname => this.component_.props.profile[fieldname])
  }

  handleSubmit = () => {
    this.component_.setState({isValidated: true})
    if (this.isFormValid()) {
      const fields = this.makeProfileDiff()
      this.component_.props.onSubmit(fields)
    }
  }

  getBackHandler = () => {
    const {onBack} = this.component_.props
    if (!onBack) {
      return null
    }
    return () => {
      const fields = this.makeProfileDiff()
      onBack(fields)
    }
  }

  makeProfileDiff() {
    return _pick(this.component_.props.profile, Object.keys(this.fieldNames_))
  }

  // TODO(cyrille): Remove state from notification and account steps before removing the setState
  // here.
  handleChange = field => value => {
    const {onChange} = this.component_.props
    this.component_.setState({[field]: value})
    onChange && onChange({profile: {[field]: value}})
  }
}


class ProfileUpdater {
  constructor(fieldNames) {
    this.fieldNames_ = fieldNames
  }

  // TODO(cyrille): Remove once its use has been removed from all steps.
  getDerivedStateFromProps({profile}) {
    return _pick(profile, Object.keys(this.fieldNames_))
  }

  attachToComponent(component) {
    return new ComponentProfileUpdater(this.fieldNames_, component)
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
    progressInStep: PropTypes.number.isRequired,
    stepNumber: PropTypes.number,
    style: PropTypes.object,
    title: PropTypes.string,
    totalStepCount: PropTypes.number,
  }

  static defaultProps = {
    progressInStep: 0,
  }

  render() {
    const {children, explanation, fastForward, nextButtonContent, onPreviousButtonClick,
      onNextButtonClick, contentStyle, progressInStep, style, stepNumber, totalStepCount,
      isNextButtonDisabled, title} = this.props
    const stepStyle = {
      alignItems: isMobileVersion ? 'stretch' : 'center',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      ...style,
    }
    const titleStyle = {
      color: colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.3,
      marginTop: 40,
      textAlign: 'center',
    }
    const explanationStyle = {
      color: colors.GREYISH_BROWN,
      fontSize: 14,
      lineHeight: 1.4,
      marginTop: 10,
      textAlign: 'center',
    }
    const containerStyle = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      marginTop: 33,
      padding: '0 20px',
      width: isMobileVersion ? 'initial' : 480,
      ...contentStyle,
    }
    const navigationStyle = {
      display: 'flex',
      marginBottom: isMobileVersion ? 20 : 40,
      marginTop: 15,
    }
    const mobileButtonStyle = {
      margin: '0 auto',
      minWidth: 130,
      padding: '13px 16px',
    }
    const buttonStyle = isMobileVersion ? mobileButtonStyle : {}
    const isLastOnboardingStep = totalStepCount && totalStepCount === stepNumber
    return <div style={stepStyle}>
      <FastForward onForward={fastForward} />
      {title ? <PaddedOnMobile><div style={titleStyle}>{title}</div></PaddedOnMobile> : null}
      {stepNumber && totalStepCount ? <PercentBar
        color={colors.BOB_BLUE}
        height={15}
        percent={Math.round(100 * (stepNumber - .5 + progressInStep) / totalStepCount)}
        isPercentShown={false}
        style={{margin: '10px auto 0', maxWidth: 425, width: '90%'}}
      /> : null
      }
      {explanation ? <div style={explanationStyle}>{explanation}</div> : null}
      <div style={containerStyle}>
        {children}
      </div>
      {onPreviousButtonClick || onNextButtonClick ? <div style={navigationStyle}>
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
      </div> : null}
    </div>
  }
}


class OnboardingCommentContent extends React.Component {
  static propTypes = {
    comment: PropTypes.shape({
      stringParts: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    }),
    style: PropTypes.object,
  }

  render() {
    const {comment: {stringParts = []} = {}, style} = this.props
    if (!stringParts.length) {
      return <div style={{marginBottom: 25, ...style}} />
    }
    const containerStyle = {
      alignItems: 'start',
      display: 'flex',
      marginBottom: 30,
      marginTop: 10,
      ...style,
    }
    const textStyle = {
      backgroundColor: colors.NEW_GREY,
      borderRadius: '5px 15px 15px',
      flex: 1,
      lineHeight: 1.5,
      marginLeft: 13,
      marginTop: 10,
      padding: '10px 15px 5px 10px',
    }
    return <div style={containerStyle}>
      <img style={{width: 30}} src={bobHeadImage} alt={config.productName} />
      <div style={textStyle}>
        {stringParts.map((str, index) =>
          <span style={{fontWeight: index % 2 ? 'bold' : 'initial'}} key={index}>{str}</span>)}
      </div>
    </div>
  }
}


class OnboardingCommentBase extends React.Component {
  static bestComment({commentAfter, commentBefore, shouldShowAfter}) {
    return shouldShowAfter && commentAfter || commentBefore
  }

  static propTypes = {
    children: PropTypes.node,
    commentAfter: PropTypes.shape({
      stringParts: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    }),
    commentBefore: PropTypes.shape({
      stringParts: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    }),
    // Minimal duration of the wait before the commentAfter is shown. If fetching the comment is
    // longer the wait won't be delayed unnecessarily.
    computingDelayMillisecs: PropTypes.number,
    isFetching: PropTypes.bool,
    onDone: PropTypes.func.isRequired,
    // Duration of the wait after the commentAfter is shown, to let the user read the comment before
    // resuming filling the form.
    // TODO(cyrille): Remove all this logic.
    readingDelayMillisec: PropTypes.number,
    shouldShowAfter: PropTypes.bool,
  }

  static defaultProps = {
    computingDelayMillisecs: 500,
    onDone: () => {},
    readingDelayMillisec: 0,
  }

  state = {
    // TODO(cyrille): Remove once following issue is resolved:
    //   https://github.com/yannickcr/eslint-plugin-react/issues/1759
    // eslint-disable-next-line react/no-unused-state
    isComputing: this.props.shouldShowAfter,
  }

  static getDerivedStateFromProps(props, {isComputing, shownComment}) {
    if (isComputing) {
      if (props.commentBefore && props.commentBefore !== shownComment) {
        return {shownComment: props.commentBefore}
      }
      return null
    }
    const bestComment = OnboardingCommentBase.bestComment(props)
    if (bestComment !== shownComment) {
      return {shownComment: bestComment}
    }
    return null
  }

  componentDidMount() {
    const {computingDelayMillisecs, shouldShowAfter} = this.props
    if (!shouldShowAfter) {
      return
    }
    this.computingTimeout = setTimeout(() => this.setState({
      // TODO(cyrille): Remove once following issue is resolved:
      //   https://github.com/yannickcr/eslint-plugin-react/issues/1759
      // eslint-disable-next-line react/no-unused-state
      isComputing: false,
      shownComment: OnboardingCommentBase.bestComment(this.props),
    }), computingDelayMillisecs)
  }

  componentDidUpdate(
    {isFetching: wasFetching, shouldShowAfter: didShowAfter}, {shownComment: prevShownComment}) {
    const {shownComment} = this.state
    const {commentAfter, isFetching, onDone, readingDelayMillisec, shouldShowAfter} = this.props
    if (shouldShowAfter && didShowAfter && prevShownComment !== shownComment) {
      clearTimeout(this.readingTimeout)
      this.readingTimeout = setTimeout(onDone, shownComment ? readingDelayMillisec : 0)
    }
    if (shouldShowAfter && wasFetching && !isFetching && !commentAfter) {
      onDone()
    }
  }

  componentWillUnmount() {
    clearTimeout(this.computingTimeout)
    clearTimeout(this.readingTimeout)
  }

  render() {
    const {shownComment} = this.state
    return <OnboardingCommentContent
      comment={shownComment} {..._omit(this.props, [
        'commentAfter',
        'commentBefore',
        'computingDelayMillisecs',
        'onDone',
        'readingDelayMillisec',
        'shouldShowAfter',
      ])} />
  }
}
// This component adds a comment from server relevant for the given field.
//
// It expects a `field` prop to know which comments from server are relevant.
//
// It needs to be invoked with a key prop to ensure it will be reset every time its
// comment might be recomputed. For instance, on TARGET_JOB_FIELD,
// use key={targetJob && targetJob.codeOgr || ''}.
const OnboardingComment = connect(
  ({app: {quickDiagnostic: {after = {}, before = {}}}, asyncState: {isFetching}}, {field}) => ({
    commentAfter: after[field] && after[field].comment,
    commentBefore: before[field] && before[field].comment,
    isFetching: isFetching[DIAGNOSE_ONBOARDING],
  })
)(OnboardingCommentBase)


export {Step, ProfileUpdater, OnboardingComment}
