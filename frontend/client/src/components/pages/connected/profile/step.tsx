import type {TFunction} from 'i18next'
import _pick from 'lodash/pick'
import _zipObject from 'lodash/zipObject'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import useFastForward from 'hooks/fast_forward'
import type {DispatchAllActions, RootState} from 'store/actions'
import {onboardingCommentIsShown} from 'store/actions'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import {FixedButtonNavigation} from 'components/navigation'
import PercentBar from 'components/percent_bar'
import {Ellipsis} from 'components/phylactery'
import {PADDED_ON_MOBILE} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'


export interface StepProps {
  buttonsOverride?: React.ReactNode
  contentStyle?: React.CSSProperties
  explanation?: React.ReactNode
  isLastOnboardingStep: boolean
  isShownAsStepsDuringOnboarding: boolean
  nextButtonContent?: React.ReactNode
  onPreviousButtonClick?: (() => void) | null
  profile: bayes.bob.UserProfile
  stepNumber?: number
  style?: React.CSSProperties
  t: TFunction
  totalStepCount?: number
}

interface Focusable {
  focus(): void
}


const navigationStyle: React.CSSProperties = {
  display: 'flex',
  marginBottom: 40,
  marginTop: 15,
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
  onNextButtonClick: () => void
  progressInStep?: number
  title?: string
}


const StepBase = (props: BaseStepProps): React.ReactElement => {
  const {buttonsOverride, children, explanation, fastForward, isLastOnboardingStep,
    isShownAsStepsDuringOnboarding,
    nextButtonContent, onPreviousButtonClick, onNextButtonClick, contentStyle, progressInStep = 0,
    style, stepNumber, totalStepCount, t, title} = props
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
    padding: PADDED_ON_MOBILE,
    textAlign: 'center',
  }
  const explanationStyle: React.CSSProperties = {
    color: colors.GREYISH_BROWN,
    fontSize: 14,
    lineHeight: 1.4,
    marginTop: 10,
    padding: '0 20px',
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
  useFastForward(fastForward)
  const nextButtonText = nextButtonContent || (isLastOnboardingStep ?
    t('Terminer le questionnaire') : t('Suivant'))
  return <div style={stepStyle} className={isShownAsStepsDuringOnboarding ? '' : 'profile'}>
    {title ? isShownAsStepsDuringOnboarding ?
      <h1 style={titleStyle}>{title}</h1> :
      <div style={titleStyle}>{title}</div> : null}
    {stepNumber && totalStepCount ? <PercentBar
      color={colors.BOB_BLUE}
      height={15}
      percent={Math.round(100 * (stepNumber - 1 + progressInStep) / totalStepCount)}
      aria-label={t(
        'étape {{stepNumber}} sur {{totalStepCount}}',
        {stepNumber, totalStepCount},
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalStepCount}
      aria-valuenow={stepNumber}
      isPercentShown={false}
      style={{margin: '10px auto 0', maxWidth: 425, width: '90%'}}
    /> : null
    }
    {explanation ? <div style={explanationStyle}>{explanation}</div> : null}
    <div style={containerStyle}>
      {children}
    </div>
    {buttonsOverride || (isMobileVersion ?
      <FixedButtonNavigation onClick={onNextButtonClick}>
        {nextButtonText}
      </FixedButtonNavigation> :
      <div style={navigationStyle}>
        {onPreviousButtonClick ? <Button
          type="discreet" onClick={onPreviousButtonClick} style={{marginRight: 20}}
          isRound={true}>
          {t('Précédent')}
        </Button> : null}
        <Button isRound={true} onClick={onNextButtonClick}>
          {nextButtonText}
        </Button>
      </div>)}
  </div>
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
      return (): void => window.clearTimeout(timeout)
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
const OnboardingCommentContent = React.memo(OnboardingCommentContentBase)


interface OnboardingCommentProps {
  children?: React.ReactNode
  // Minimal duration of the wait before the commentAfter is shown. If fetching the comment is
  // longer the wait won't be delayed unnecessarily.
  computingDelayMillisecs?: number
  field: bayes.bob.ProjectOrProfileField
  onDone?: () => void
  // Whether the user has answered.
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
    return (): void => window.clearTimeout(timeout)
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


type UserField = keyof bayes.bob.UserProfile
type ProfileFieldsRequirements = {
  [fieldname in UserField]?: boolean
}


interface ProfileUpdaterHook {
  handleBack: (() => void)|undefined
  handleSubmit: () => void
  inputsRefMap: {[fieldname in UserField]?: React.Ref<Focusable>}
  isFormValid: boolean
  isValidated: boolean
}


function useProfileUpdater(
  fieldsRequired: ProfileFieldsRequirements, profile: bayes.bob.UserProfile,
  onSubmit?: (value: bayes.bob.UserProfile) => void,
  onBack?: (value: bayes.bob.UserProfile) => void,
  fieldsOrder?: readonly UserField[],
): ProfileUpdaterHook {
  const [isValidated, setIsValidated] = useState(false)
  const isFormValid = (Object.keys(fieldsRequired) as (keyof bayes.bob.UserProfile)[]).
    filter((fieldName: (keyof bayes.bob.UserProfile)): boolean => !!fieldsRequired[fieldName]).
    every((fieldname: (keyof bayes.bob.UserProfile)): boolean => !!profile[fieldname])

  const inputsRef = useRef<readonly React.RefObject<Focusable>[] | undefined>()
  if (fieldsOrder && (!inputsRef.current || inputsRef.current.length !== fieldsOrder.length)) {
    inputsRef.current = Array.from(
      {length: fieldsOrder.length},
      (): React.RefObject<Focusable> => React.createRef(),
    )
  }
  const inputsRefMap = useMemo(
    () => fieldsOrder && inputsRef.current && _zipObject(fieldsOrder, inputsRef.current) || {},
    [fieldsOrder],
  )

  const handleBack = useCallback((): void => {
    const profileDiff = _pick(profile, Object.keys(fieldsRequired))
    onBack?.(profileDiff)
  }, [fieldsRequired, onBack, profile])
  const handleSubmit = useCallback((): void => {
    setIsValidated(true)
    if (!isFormValid) {
      if (fieldsOrder && inputsRefMap) {
        const firstRequired = fieldsOrder.
          find((fieldname) => !profile[fieldname] && inputsRefMap[fieldname]?.current)
        if (firstRequired) {
          inputsRefMap[firstRequired]?.current?.focus()
        }
      }
      return
    }
    const profileDiff = _pick(profile, Object.keys(fieldsRequired))
    onSubmit?.(profileDiff)
  }, [fieldsOrder, fieldsRequired, inputsRefMap, isFormValid, onSubmit, profile])
  return {
    handleBack: onBack && handleBack || undefined,
    handleSubmit,
    inputsRefMap,
    isFormValid,
    isValidated,
  }
}


export {Step, OnboardingComment, OnboardingCommentContent, useProfileChangeCallback,
  useProfileUpdater}
