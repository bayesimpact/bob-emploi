import {TFunction} from 'i18next'
import _pick from 'lodash/pick'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllActions, RootState, onboardingCommentIsShown} from 'store/actions'

import {useFastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Ellipsis} from 'components/phylactery'
import {Button, PaddedOnMobile, PercentBar} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'


export interface StepProps {
  buttonsOverride?: React.ReactNode
  contentStyle?: React.CSSProperties
  explanation?: React.ReactNode
  isNextButtonDisabled?: boolean
  isShownAsStepsDuringOnboarding: boolean
  nextButtonContent?: React.ReactNode
  onPreviousButtonClick?: (() => void) | null
  profile: bayes.bob.UserProfile
  stepNumber?: number
  style?: React.CSSProperties
  t: TFunction
  totalStepCount?: number
}


export interface ProfileStepProps extends StepProps {
  featuresEnabled: bayes.bob.Features
  hasAccount?: boolean
  onBack?: (value: bayes.bob.UserProfile) => void
  onChange?: (value: {profile: bayes.bob.UserProfile}) => void
  onSubmit?: (value: bayes.bob.UserProfile) => void
  title?: string
}


export interface ProjectStepProps extends StepProps {
  featuresEnabled?: bayes.bob.Features
  isShownAsStepsDuringOnboarding: true
  onSubmit: (newValue: bayes.bob.Project) => void
  newProject: bayes.bob.Project
}


interface BaseStepProps extends StepProps {
  children: React.ReactNode
  fastForward: () => void
  onNextButtonClick?: () => void
  progressInStep?: number
  title?: string
}


const StepBase = (props: BaseStepProps): React.ReactElement => {
  const {buttonsOverride, children, explanation, fastForward, isShownAsStepsDuringOnboarding,
    nextButtonContent, onPreviousButtonClick, onNextButtonClick, contentStyle, progressInStep = 0,
    style, stepNumber, totalStepCount, isNextButtonDisabled, t, title} = props
  const stepStyle: React.CSSProperties = {
    alignItems: isMobileVersion ? 'stretch' : 'center',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    ...style,
  }
  const titleStyle: React.CSSProperties = {
    fontSize: 23,
    fontWeight: 500,
    lineHeight: 1.3,
    marginBottom: isMobileVersion && !isShownAsStepsDuringOnboarding ? 20 : 0,
    marginTop: isMobileVersion && !isShownAsStepsDuringOnboarding ? 0 : 40,
    textAlign: 'center',
  }
  const explanationStyle: React.CSSProperties = {
    color: colors.GREYISH_BROWN,
    fontSize: 14,
    lineHeight: 1.4,
    marginTop: 10,
    textAlign: 'center',
  }
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    marginTop: 33,
    padding: '0 20px',
    width: isMobileVersion ? 'initial' : 480,
    ...contentStyle,
  }
  const navigationStyle: React.CSSProperties = {
    display: 'flex',
    marginBottom: isMobileVersion ? 20 : 40,
    marginTop: 15,
  }
  const mobileButtonStyle: React.CSSProperties = {
    margin: '0 auto',
    minWidth: 130,
    padding: '13px 16px',
  }
  const buttonStyle = isMobileVersion ? mobileButtonStyle : {}
  const isLastOnboardingStep = totalStepCount && totalStepCount === stepNumber
  useFastForward(fastForward)
  return <div style={stepStyle} className={isShownAsStepsDuringOnboarding ? '' : 'profile'}>
    {title ? <PaddedOnMobile><div style={titleStyle}>{title}</div></PaddedOnMobile> : null}
    {stepNumber && totalStepCount ? <PercentBar
      color={colors.BOB_BLUE}
      height={15}
      percent={Math.round(100 * (stepNumber - 1 + progressInStep) / totalStepCount)}
      isPercentShown={false}
      style={{margin: '10px auto 0', maxWidth: 425, width: '90%'}}
    /> : null
    }
    {explanation ? <div style={explanationStyle}>{explanation}</div> : null}
    <div style={containerStyle}>
      {children}
    </div>
    {buttonsOverride ? buttonsOverride :
      onPreviousButtonClick || onNextButtonClick ? <div style={navigationStyle}>
        {onPreviousButtonClick ? <Button
          type="back" onClick={onPreviousButtonClick} style={{...buttonStyle, marginRight: 20}}
          isRound={true}>
          {t('Précédent')}
        </Button> : null}
        {onNextButtonClick ? <Button
          isRound={true}
          onClick={onNextButtonClick}
          disabled={isNextButtonDisabled}
          style={buttonStyle}>
          {nextButtonContent || (isLastOnboardingStep ?
            t('Terminer le questionnaire') : t('Suivant'))}
        </Button> : null}
      </div> : null}
  </div>
}
StepBase.propTypes = {
  buttonsOverride: PropTypes.node,
  children: PropTypes.node.isRequired,
  contentStyle: PropTypes.object,
  explanation: PropTypes.node,
  fastForward: PropTypes.func.isRequired,
  isNextButtonDisabled: PropTypes.bool,
  isShownAsStepsDuringOnboarding: PropTypes.bool,
  nextButtonContent: PropTypes.node,
  onNextButtonClick: PropTypes.func,
  onPreviousButtonClick: PropTypes.func,
  progressInStep: PropTypes.number,
  stepNumber: PropTypes.number,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
  title: PropTypes.string,
  totalStepCount: PropTypes.number,
}
const Step = React.memo(StepBase)


interface OnboardingCommentContentProps {
  comment?: bayes.bob.BoldedString
  onShown?: () => void
  shouldWait?: boolean
  style?: React.CSSProperties
}


const OnboardingCommentContentBase = (props: OnboardingCommentContentProps): React.ReactElement => {
  const {comment: {stringParts = []} = {}, onShown, shouldWait, style} = props
  const [isWaiting, setIsWaiting] = useState(shouldWait)

  useEffect((): (() => void) => {
    if (isWaiting) {
      const timeout = window.setTimeout((): void => setIsWaiting(false), 2000)
      return (): void => clearTimeout(timeout)
    }
    onShown?.()
    return (): void => void 0
  }, [isWaiting, onShown])
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
  const ellipsisStyle: React.CSSProperties = {
    margin: '10px 0',
  }
  return <div style={containerStyle}>
    <img style={{width: 30}} src={bobHeadImage} alt={config.productName} />
    {isWaiting ? <Ellipsis style={ellipsisStyle} /> :
      <div style={textStyle}>
        {stringParts.map((str, index): React.ReactNode =>
          <span style={{fontWeight: index % 2 ? 'bold' : 'initial'}} key={index}>{str}</span>)}
      </div>}
  </div>
}
OnboardingCommentContentBase.propTypes = {
  comment: PropTypes.shape({
    stringParts: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
  }),
  onShown: PropTypes.func,
  shouldWait: PropTypes.bool,
  style: PropTypes.object,
}
const OnboardingCommentContent = React.memo(OnboardingCommentContentBase)


interface OnboardingCommentProps {
  children?: React.ReactNode
  computingDelayMillisecs?: number
  field: bayes.bob.ProjectOrProfileField
  onDone?: () => void
  shouldShowAfter: boolean
}


const noOp = (): void => void 0
const emptyQuickDiagnostic = {after: {}, before: {}} as const


// This component adds a comment from server relevant for the given field.
//
// It expects a `field` prop to know which comments from server are relevant.
//
// It needs to be invoked with a key prop to ensure it will be reset every time its
// comment might be recomputed. For instance, on TARGET_JOB_FIELD,
// use key={targetJob && targetJob.codeOgr || ''}.
const OnboardingCommentBase = (props: OnboardingCommentProps): React.ReactElement => {
  const {computingDelayMillisecs = 0, field, onDone = noOp, shouldShowAfter, ...otherProps} = props
  const [isComputing, setIsComputing] = useState(shouldShowAfter)

  const dispatch = useDispatch<DispatchAllActions>()
  // Comment shown after the user has answered.
  const commentAfter = useSelector(
    ({app: {quickDiagnostic: {after} = emptyQuickDiagnostic}}: RootState):
    ValidDiagnosticComment|undefined => after[field])
  // Comment shown before the user has answered.
  const commentBefore = useSelector(
    ({app: {quickDiagnostic: {before} = emptyQuickDiagnostic}}: RootState):
    ValidDiagnosticComment|undefined => before[field])
  const isFetching = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean => !!isFetching['DIAGNOSE_ONBOARDING'],
  )

  const bestComment = shouldShowAfter && commentAfter || commentBefore

  const shownComment = isComputing ? commentBefore : bestComment

  useEffect((): void => {
    if (shownComment && !shownComment.hasBeenShown) {
      dispatch(onboardingCommentIsShown(shownComment))
    }
  }, [dispatch, shownComment])

  useEffect((): (() => void) => {
    if (!isComputing) {
      return (): void => void 0
    }
    const timeout = window.setTimeout((): void => setIsComputing(false), computingDelayMillisecs)
    return (): void => clearTimeout(timeout)
  }, [computingDelayMillisecs, isComputing])

  useEffect((): void => {
    if (!isFetching && shouldShowAfter) {
      onDone()
    }
  }, [shouldShowAfter, isFetching, onDone])

  return <OnboardingCommentContent
    comment={shownComment && shownComment.comment}
    shouldWait={!shownComment || !shownComment.hasBeenShown} {...otherProps} />
}
OnboardingCommentBase.propTypes = {
  children: PropTypes.node,
  // Minimal duration of the wait before the commentAfter is shown. If fetching the comment is
  // longer the wait won't be delayed unnecessarily.
  computingDelayMillisecs: PropTypes.number,
  field: PropTypes.string.isRequired,
  isFetching: PropTypes.bool,
  onDone: PropTypes.func,
  // Whether the user has answered.
  shouldShowAfter: PropTypes.bool,
}
const OnboardingComment = React.memo(OnboardingCommentBase)


function useProfileChangeCallback<K extends keyof bayes.bob.UserProfile>(
  field: K, props: bayes.bob.UserProfile,
  onChange?: (user: {profile: bayes.bob.UserProfile}) => void):
  ((value: bayes.bob.UserProfile[K]) => void) {
  const handleChange = useCallback((value: bayes.bob.UserProfile[K]): void => {
    if (value !== props[field]) {
      onChange?.({profile: {[field]: value}})
    }
  }, [field, onChange, props])
  return handleChange
}


type ProfileFieldsRequirements = {
  [fieldname in keyof bayes.bob.UserProfile]?: boolean
}


interface ProfileUpdaterHook {
  handleBack: (() => void)|undefined
  handleSubmit: () => void
  isFormValid: boolean
  isValidated: boolean
}


function useProfileUpdater(
  fieldsRequired: ProfileFieldsRequirements, profile: bayes.bob.UserProfile,
  onSubmit?: (value: bayes.bob.UserProfile) => void,
  onBack?: (value: bayes.bob.UserProfile) => void): ProfileUpdaterHook {
  const [isValidated, setIsValidated] = useState(false)
  const isFormValid = (Object.keys(fieldsRequired) as (keyof bayes.bob.UserProfile)[]).
    filter((fieldName: (keyof bayes.bob.UserProfile)): boolean => !!fieldsRequired[fieldName]).
    every((fieldname: (keyof bayes.bob.UserProfile)): boolean => !!profile[fieldname])
  const handleBack = useCallback((): void => {
    const profileDiff = _pick(profile, Object.keys(fieldsRequired))
    onBack?.(profileDiff)
  }, [fieldsRequired, onBack, profile])
  const handleSubmit = useCallback((): void => {
    setIsValidated(true)
    if (!isFormValid) {
      return
    }
    const profileDiff = _pick(profile, Object.keys(fieldsRequired))
    onSubmit?.(profileDiff)
  }, [fieldsRequired, isFormValid, onSubmit, profile])
  return {handleBack: onBack && handleBack || undefined, handleSubmit, isFormValid, isValidated}
}


export {Step, OnboardingComment, OnboardingCommentContent, useProfileChangeCallback,
  useProfileUpdater}
