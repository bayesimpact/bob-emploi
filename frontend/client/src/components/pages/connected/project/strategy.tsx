import {TFunction, TOptions} from 'i18next'
import _fromPairs from 'lodash/fromPairs'
import _groupBy from 'lodash/groupBy'
import _isEqual from 'lodash/isEqual'
import _keyBy from 'lodash/keyBy'
import _memoize from 'lodash/memoize'
import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {Route, Switch} from 'react-router'
import {Link, Redirect, useHistory, useParams} from 'react-router-dom'

import useFastForward from 'hooks/fast_forward'
import {DispatchAllActions, RootState, displayToasterMessage, emailCheck, setUserProfile,
  silentlySetupCoaching, startStrategy, replaceStrategy, stopStrategy, strategyWorkPageIsShown,
} from 'store/actions'
import {ValidAdvice, getAdviceGoal} from 'store/advice'
import {getDateString, getDiffBetweenDatesInString, upperFirstLetter} from 'store/french'
import {LocalizableString, StrategyGoal, combineTOptions, getStrategyGoals,
  prepareT} from 'store/i18n'
import {impactFromPercentDelta} from 'store/score'
import {StrategyCompletion, getStartedStrategy, getStrategyCompletion,
  getStrategyProgress, isValidStrategy} from 'store/strategy'
import {getUniqueExampleEmail, useAlwaysConvincePage, useGender} from 'store/user'
import {validateEmail} from 'store/validations'

import {AdvicePicto, WorkingMethod} from 'components/advisor'
import AppearingList from 'components/appearing_list'
import Button from 'components/button'
import CheckboxList from 'components/checkbox_list'
import {colorToAlpha} from 'components/colors'
import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Input, {Inputable} from 'components/input'
import LabeledToggle from 'components/labeled_toggle'
import {LoginLink} from 'components/login'
import Markdown from 'components/markdown'
import isMobileVersion from 'store/mobile'
import {Modal, ModalConfig, useModal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import CoachingConfirmationModal from 'components/pages/connected/coaching_modal'
import PercentBar from 'components/percent_bar'
import PieChart from 'components/pie_chart'
import {RadiumDiv, SmartLink} from 'components/radium'
import Tag from 'components/tag'
import {FastTransitions} from 'components/theme'
import {Routes} from 'components/url'
import bobHeadImage from 'images/bob-head.svg'
import goalsIcon from 'images/goals-icon.svg'
import selectedGoalsIcon from 'images/goals-icon-selected.svg'
import methodsIcon from 'images/methods-icon.svg'
import selectedMethodsIcon from 'images/methods-icon-selected.svg'

import BobModal from './speech'

// TODO(cyrille): Move to store.
interface FollowupOption {
  description: LocalizableString
  name: LocalizableString
  value: bayes.bob.EmailFrequency
}

const FOLLOWUP_EMAILS_OPTIONS: Readonly<FollowupOption[]> = [
  {
    description: prepareT('Un email pour vous booster une fois par mois'),
    name: prepareT('Occasionnel'),
    value: 'EMAIL_ONCE_A_MONTH',
  },
  {
    description: prepareT('Un email par semaine pour que rien ne vous échappe'),
    name: prepareT('Régulier'),
    value: 'EMAIL_MAXIMUM',
  },
]

const strategyCardStyle: React.CSSProperties = {
  border: `2px solid ${colors.MODAL_PROJECT_GREY}`,
  borderRadius: 20,
  padding: '15px 20px',
}

interface CoachingOptionProps {
  description: string
  isSelected: boolean
  name: string
  onClick: (option: bayes.bob.EmailFrequency) => void
  option: bayes.bob.EmailFrequency
  style: RadiumCSSProperties
}


const selectedOptionStyle: React.CSSProperties = {
  backgroundColor: colorToAlpha(colors.BOB_BLUE, .09),
  border: `2px solid ${colors.BOB_BLUE}`,
} as const
const coachingOptionDescriptionStyle = {
  color: colors.COOL_GREY,
  fontSize: 14,
  fontStyle: 'italic',
  lineHeight: '19px',
}


const CoachingOptionBase = (props: CoachingOptionProps): React.ReactElement => {
  const {description, isSelected, name, onClick, option, style} = props
  const optionStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': selectedOptionStyle,
    ...isSelected && selectedOptionStyle,
    'alignItems': 'center',
    'border': `2px solid ${colorToAlpha(colors.BOB_BLUE, 0)}`,
    'borderRadius': 10,
    'boxShadow': '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
    'cursor': 'pointer',
    'display': 'flex',
    'padding': '20px 25px',
    ...FastTransitions,
    ...style,
  }), [isSelected, style])
  const handleClick = useCallback((): void => onClick(option), [onClick, option])
  return <RadiumDiv onClick={handleClick} style={optionStyle}>
    <LabeledToggle
      style={{marginBottom: 0}}
      label={<div style={{marginLeft: 10}}>
        <h3 style={{fontSize: 18, margin: 0}}>{name}</h3>
        <div style={coachingOptionDescriptionStyle}>{description}</div>
      </div>}
      isSelected={isSelected} type="radio" />
  </RadiumDiv>
}
const CoachingOption = React.memo(CoachingOptionBase)


interface CoachingModalProps extends Omit<ModalConfig, 'children'> {
  children?: never
}

// TODO(cyrille): Make it a full-page on mobile.
const CoachingModalBase = (props: CoachingModalProps): null|React.ReactElement => {
  const {isShown, onClose} = props
  const coachingEmailFrequency = useSelector(
    ({user: {profile: {coachingEmailFrequency} = {}}}: RootState):
    bayes.bob.EmailFrequency|undefined =>
      coachingEmailFrequency,
  )
  const isRegistrationNeeded = useSelector(
    ({user: {hasAccount, profile: {email} = {}}}: RootState): boolean => !hasAccount && !email,
  )
  const {t, t: translate} = useTranslation()
  const dispatch = useDispatch<DispatchAllActions>()

  const [frequency, setFrequency] = useState(coachingEmailFrequency)

  useLayoutEffect((): void => {
    if (!isShown) {
      setFrequency(coachingEmailFrequency)
    }
  }, [coachingEmailFrequency, isShown])

  const handleCloseRegistrationModal = useCallback(async () => {
    await dispatch(setUserProfile(
      {coachingEmailFrequency: undefined}, true, 'FINISH_PROFILE_SETTINGS'))
    dispatch(displayToasterMessage(t('Le coaching a été annulé')))
  }, [dispatch, t])

  const handleConfirm = useCallback(async () => {
    // TODO(cyrille): Change action to something specific remembering the strategy.
    const success = await dispatch(
      setUserProfile({coachingEmailFrequency: frequency}, true, 'FINISH_PROFILE_SETTINGS'))
    if (success) {
      onClose?.()
      dispatch(displayToasterMessage(t('Modifications sauvegardées.')))
    }
  }, [dispatch, frequency, onClose, t])
  if (!config.isCoachingEnabled) {
    return null
  }

  const contentStyle = {
    padding: isMobileVersion ? 30 : '30px 50px 50px',
  }
  const buttonsStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 40,
  }
  return <React.Fragment>
    {isRegistrationNeeded ? <CoachingConfirmationModal
      coachingEmailFrequency={coachingEmailFrequency}
      onCloseModal={handleCloseRegistrationModal} /> : null}
    <Modal
      isShown={isShown} onClose={onClose} style={{margin: 20}}
      title={t('Choisissez le coaching qui vous convient')}>
      <div style={contentStyle}>
        {FOLLOWUP_EMAILS_OPTIONS.map(({description, name, value, ...option}): React.ReactNode =>
          <CoachingOption
            {...option} isSelected={frequency === value}
            description={translate(...description)} name={translate(...name)}
            onClick={setFrequency} option={value}
            key={value} style={{marginBottom: 20}} />)}
        <div style={buttonsStyle}>
          <Button isRound={true} type="back" style={{marginRight: 15}} onClick={onClose}>
            {t('Annuler')}
          </Button>
          <Button isRound={true} disabled={!frequency} onClick={handleConfirm}>
            {t('Continuer')}
          </Button>
        </div>
      </div>
    </Modal>
  </React.Fragment>
}
const CoachingModal = React.memo(CoachingModalBase)


interface SelectCoachingProps {
  onClick?: () => void
  style?: RadiumCSSProperties
}


const selectCoachingHeaderStyle = {
  color: colors.COOL_GREY,
  fontSize: 14,
  fontStyle: 'italic',
  lineHeight: '19px',
}
const selectCoachingNameStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 'bold',
}


const SelectCoachingBase = (props: SelectCoachingProps): React.ReactElement|null => {
  const {style, onClick} = props
  const frequency = useSelector(({user: {
    profile: {coachingEmailFrequency} = {},
  }}: RootState): bayes.bob.EmailFrequency|undefined => coachingEmailFrequency)
  const {t, t: translate} = useTranslation()
  const containerStyle = useMemo((): RadiumCSSProperties => ({
    ...strategyCardStyle,
    ':hover': {
      border: `2px solid ${colors.COOL_GREY}`,
    },
    'alignItems': 'center',
    ...!!onClick && {cursor: 'pointer'},
    'display': 'flex',
    'padding': '20px 25px',
    ...style,
  }), [onClick, style])
  if (!config.isCoachingEnabled) {
    return null
  }
  if (!frequency || frequency === 'EMAIL_NONE' || frequency === 'UNKNOWN_EMAIL_FREQUENCY') {
    return <Button
      onClick={onClick}
      isRound={true} style={{display: 'block', ...style}}>
      {t('Activer le coaching de {{productName}}', {productName: config.productName})}
    </Button>
  }
  const {name} = FOLLOWUP_EMAILS_OPTIONS.find(({value}): boolean => value === frequency) || {}
  return <RadiumDiv onClick={onClick} style={containerStyle}>
    <div style={{flex: 1}}>
      <div style={selectCoachingHeaderStyle}>{t('Type de coaching\u00A0:')}</div>
      <div style={selectCoachingNameStyle}>{name && translate(...name) || ''}</div>
    </div>
    <ChevronDownIcon size={24} />
  </RadiumDiv>
}
const SelectCoaching = React.memo(SelectCoachingBase)


interface StopStrategyModalProps extends Omit<ModalConfig, 'children'|'title'> {
  isPrincipal: boolean
  onClose: () => void
  onConfirm: () => void
}


const stopStrategyTextStyle: React.CSSProperties = {
  margin: '30px 50px',
  maxWidth: 400,
}
const buttonsContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 50,
  marginTop: 5,
}
const cancelButtonStyle: React.CSSProperties = {
  marginRight: 15,
}

const StopStrategyModalBase = (props: StopStrategyModalProps): React.ReactElement => {
  const {isPrincipal, onClose, onConfirm, ...modalProps} = props
  const gender = useGender()
  const {t} = useTranslation()
  return <Modal
    {...modalProps} onClose={onClose}
    title={t('Êtes-vous sûr·e de vouloir arrêter\u00A0?', {context: gender})}>
    {isPrincipal ? <Trans style={stopStrategyTextStyle}>
      Si vous arrêtez maintenant, toute votre progression sera perdue et vos données seront
      supprimées… En plus cette stratégie est la plus
      importante dans votre situation, c'est dommage d'arrêter maintenant.
    </Trans> : <Trans style={stopStrategyTextStyle}>
      Si vous arrêtez maintenant, toute votre progression sera perdue et vos données seront
      supprimées… C'est dommage d'arrêter maintenant.
    </Trans>}
    <Trans style={buttonsContainerStyle}>
      <Button onClick={onClose} type="back" isRound={true} style={cancelButtonStyle}>
        Annuler
      </Button>
      <Button onClick={onConfirm} type="deletion" isRound={true}>Arrêter</Button>
    </Trans>
  </Modal>
}
const StopStrategyModal = React.memo(StopStrategyModalBase)


interface GoalsPanelProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  isPrincipal: boolean
  onChange: (reachedGoals: {[key: string]: boolean}) => void
  openedStrategy: bayes.bob.WorkingStrategy & {strategyId: string}
  project: bayes.bob.Project
  style?: React.CSSProperties
}


const goalsPieChartStyle: React.CSSProperties = {
  margin: '10px auto 20px',
}
const goalsSelectionEditorStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  fontSize: 13,
  padding: '20px 0 0',
}
const goalsGrowingNumberStyle: React.CSSProperties = {
  color: colors.DARK_TWO,
  fontSize: 20,
}
const selectCoachingButtonStyle: React.CSSProperties = {
  margin: '20px auto 0',
}
const stopStrategyButtonStyle: React.CSSProperties = {
  color: colors.SLATE,
  display: 'block',
  fontSize: 13,
  fontStyle: 'italic',
  margin: '5px auto 0',
}


const GoalsPanelBase = (props: GoalsPanelProps): React.ReactElement => {
  const {
    isPrincipal,
    onChange,
    openedStrategy: {reachedGoals = {}, strategyId},
    project,
    style,
  } = props
  const [isCoachingModalShown, showCoachingModal, hideCoachingModal] = useModal()
  const [isStopStrategyModalShown, showStopStrategyModal, hideStopStrategyModal] = useModal()
  const dispatch = useDispatch<DispatchAllActions>()
  const handleStopStrategyClick = useCallback(() => {
    hideStopStrategyModal()
    dispatch(stopStrategy(project, {strategyId}))
  }, [dispatch, hideStopStrategyModal, project, strategyId])
  const {t} = useTranslation()
  const goals = getStrategyGoals(strategyId, t)
  const progress = Math.round(getStrategyProgress(goals, reachedGoals))
  return <StratPanel style={style} title={t('Vos objectifs')}>
    <CoachingModal isShown={isCoachingModalShown} onClose={hideCoachingModal} />
    <StopStrategyModal
      isShown={isStopStrategyModalShown} onClose={hideStopStrategyModal}
      onConfirm={handleStopStrategyClick} isPrincipal={isPrincipal} />
    <div style={strategyCardStyle}>
      <PieChart
        radius={40} strokeWidth={6} backgroundColor={colors.MODAL_PROJECT_GREY}
        percentage={progress} style={goalsPieChartStyle} color={colors.GREENISH_TEAL}>
        <span style={goalsGrowingNumberStyle}>
          <GrowingNumber isSteady={true} number={progress} />%
        </span>
      </PieChart>
      <GoalsSelectionEditor
        onSubmit={onChange} style={goalsSelectionEditorStyle}
        {...{goals, reachedGoals}} />
    </div>
    <SelectCoaching style={selectCoachingButtonStyle} onClick={showCoachingModal} />
    <Button
      type="discreet" onClick={showStopStrategyModal} style={stopStrategyButtonStyle}
      isRound={true}>
      {t('Arrêter cette stratégie')}
    </Button>
  </StratPanel>
}
const GoalsPanel = React.memo(GoalsPanelBase)


interface WhyButtonProps {
  onClick?: (event: React.MouseEvent) => void
  strategy: bayes.bob.Strategy
  style?: React.CSSProperties
}

const WhyButtonBase = (props: WhyButtonProps): React.ReactElement|null => {
  const {onClick, strategy: {header: why}, style} = props
  const [isModalShown, showModal, hideModal] = useModal()
  const {t} = useTranslation()

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    onClick && onClick(event)
    showModal()
  }, [onClick, showModal])

  const buttonStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': {
      boxShadow: 'rgba(0, 0, 0, 0.2) 0px 4px 10px 0px',
      color: 'inherit',
    },
    'alignItems': 'center',
    'border': `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    'borderRadius': 20,
    'color': colors.WARM_GREY,
    'cursor': 'pointer',
    'display': 'inline-flex',
    'fontSize': 11,
    'fontStyle': 'italic',
    'fontWeight': 'bold',
    'padding': '5px 12px 5px 5px',
    ...style,
  }), [style])
  if (!why) {
    return null
  }
  const bobStyle = {
    display: 'block',
    marginRight: 9,
    width: 15,
  }
  return <React.Fragment>
    <BobModal onConfirm={hideModal} isShown={isModalShown} buttonText="OK">
      {why}
    </BobModal>
    <RadiumDiv onClick={handleClick} style={buttonStyle}>
      <img src={bobHeadImage} alt={config.productName} style={bobStyle} />
      {t("L'explication de {{productName}}", {productName: config.productName})}
    </RadiumDiv>
  </React.Fragment>
}
WhyButtonBase.propTypes = {
  onClick: PropTypes.func,
  strategy: PropTypes.shape({
    header: PropTypes.string,
  }).isRequired,
  style: PropTypes.object,
}
const WhyButton = React.memo(WhyButtonBase)


interface ListItemProps {
  chevronSize?: number
  hasStartedOtherStrategy: boolean
  project: bayes.bob.Project
  rank: number
  strategy: bayes.bob.Strategy & {strategyId: string}
  strategyCompletion: StrategyCompletion
  strategyUrl?: string
  style?: RadiumCSSProperties
}

const getContainerStyle = (style: React.CSSProperties|undefined, isStarted: boolean):
React.CSSProperties => ({
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
  cursor: isStarted ? 'pointer' : 'initial',
  display: 'block',
  ...style,
})

const contentStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontSize: 15,
  padding: isMobileVersion ? 20 : '30px 30px 30px 40px',
}

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 3,
}

const tagStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  backgroundColor: colors.RED_PINK,
  boxShadow: '0 5px 6px 0 rgba(0, 0, 0, 0.1)',
  fontSize: 11,
  fontStyle: 'italic',
  fontWeight: 'bold',
  marginLeft: 10,
  textTransform: 'initial',
}

const flexFillerStyle: React.CSSProperties = {
  flex: 1,
}

const completedStyle: React.CSSProperties = {
  backgroundColor: colors.GREENISH_TEAL,
  borderRadius: '50%',
  color: '#fff',
  marginRight: 10,
  padding: 5,
}

const startButtonStyle: React.CSSProperties = {
  padding: '12px 25px',
}

const footerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.LIGHT_GREY,
  borderRadius: '0 0 10px 10px',
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  display: 'flex',
  height: 29,
  overflow: 'hidden',
  position: 'relative',
}

const getProgressBarStyle = (percent: number): React.CSSProperties => ({
  backgroundColor: colors.BOB_BLUE,
  height: '100%',
  width: `${percent}%`,
})

// TODO(cyrille): Handle when the progress bar meets this text.
const progressValueStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 'bold',
  position: 'absolute',
  right: 30,
}

const footerBobStyle: React.CSSProperties = {
  marginLeft: 15,
  marginRight: 7,
  width: 18,
}

const footerTextStyle: React.CSSProperties = {
  fontSize: 11,
  fontStyle: 'italic',
  paddingRight: 15,
}

const getImpactStyle = _memoize((color: string): React.CSSProperties => ({
  color,
  fontWeight: 'bold',
}))

const StrategyListItemBase: React.FC<ListItemProps> = (props): React.ReactElement => {
  // TODO(cyrille): Handle completed strategies.
  const {chevronSize, hasStartedOtherStrategy, project,
    strategy: {externalUrl, isPrincipal, description, score, strategyId, title},
    strategyCompletion: {isComplete, isStarted, progress},
    rank, strategyUrl, style} = props
  const isCurrent = isStarted && !isComplete
  const containerStyle = useMemo(
    (): React.CSSProperties => getContainerStyle(style, isStarted), [style, isStarted])
  const progressBarStyle = useMemo(
    (): React.CSSProperties => getProgressBarStyle(progress), [progress])
  const [isModalShown, showModal, hideModal] = useModal()
  const {t} = useTranslation()
  const goals = useMemo(
    (): readonly StrategyGoal[] => getStrategyGoals(strategyId, t),
    [t, strategyId],
  )
  const dispatch = useDispatch<DispatchAllActions>()
  const onStart = useCallback(() => {
    if (externalUrl) {
      dispatch(startStrategy(project, {strategyId}, rank))
      dispatch(replaceStrategy(project, {strategyId}))
      window.location.href = externalUrl
      return
    }
    showModal()
  }, [dispatch, externalUrl, project, rank, showModal, strategyId])
  const history = useHistory()
  const redirectToStratPage = useCallback(() => {
    dispatch(startStrategy(project, {strategyId}, rank))
    dispatch(replaceStrategy(project, {strategyId}))
    if (strategyUrl) {
      history.push(strategyUrl)
    }
  }, [dispatch, history, project, rank, strategyId, strategyUrl])
  const {color} = impactFromPercentDelta(score || 0)
  return <SmartLink
    to={isStarted && !externalUrl ? strategyUrl : undefined} style={containerStyle}
    href={isStarted && externalUrl || undefined}>
    <StartStrategyModal
      isShown={isModalShown} onClose={hideModal} onSubmit={redirectToStratPage}
      hasStartedOtherStrategy={hasStartedOtherStrategy} goals={goals} strategyId={strategyId} />
    <div style={contentStyle}>
      <div>
        <div style={titleStyle}>{title}</div>
        <Trans>Impact&nbsp;: <span style={getImpactStyle(color)}>+&nbsp;{{score}}%</span></Trans>
      </div>
      {isPrincipal ? <Tag style={tagStyle}>{t('Priorité')}</Tag> : null}
      <div style={flexFillerStyle} />
      {isComplete ? <CheckIcon style={completedStyle} size={30} /> : null}
      {strategyUrl ? isStarted ? <ChevronRightIcon size={chevronSize} /> :
        <Button
          style={startButtonStyle} isRound={true} type="navigation" onClick={onStart}>
          {t('Commencer')}
        </Button> : null}
    </div>
    {isCurrent ? <div style={footerStyle}>
      <div style={progressBarStyle} />
      <div style={progressValueStyle}>{Math.round(progress)}%</div>
    </div> : description ? <div style={footerStyle}>
      <img src={bobHeadImage} style={footerBobStyle} alt={config.productName} />
      <span style={footerTextStyle}>{description}</span>
    </div> : null}
  </SmartLink>
}
StrategyListItemBase.propTypes = {
  chevronSize: PropTypes.number.isRequired,
  hasStartedOtherStrategy: PropTypes.bool.isRequired,
  project: PropTypes.object.isRequired,
  rank: PropTypes.number.isRequired,
  strategy: PropTypes.shape({
    description: PropTypes.string,
    externalUrl: PropTypes.string,
    isPrincipal: PropTypes.bool,
    score: PropTypes.number,
    strategyId: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
  strategyCompletion: PropTypes.object.isRequired,
  strategyUrl: PropTypes.string,
  style: PropTypes.object,
}
StrategyListItemBase.defaultProps = {
  chevronSize: 24,
}
const StrategyListItem = React.memo(StrategyListItemBase)


const startStrategyModalStyle: React.CSSProperties = {
  fontSize: 14,
  maxWidth: 500,
  padding: isMobileVersion ? '30px 20px 50px' : '30px 50px 50px',
}
const startStrategyModalSubmitButtonStyle: React.CSSProperties = {
  marginTop: 30,
  textAlign: 'center',
}
const startStrategyModalInputStyle: React.CSSProperties = {
  marginTop: 20,
}
const errorStyle: React.CSSProperties = {
  border: `1px solid ${colors.RED_PINK}`,
}
const alreadyUsedWarningStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 13,
  fontStyle: 'italic',
  marginTop: 5,
}
const covidWarningStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_PROJECT_GREY,
  borderRadius: 9,
  fontStyle: 'italic',
  marginTop: 30,
  padding: '15px 23px',
}
const blueLinkStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
}


interface StartStrategyModalProps extends Omit<ModalConfig, 'children'> {
  goals: readonly StrategyGoal[]
  hasStartedOtherStrategy: boolean
  onSubmit: () => void
  strategyId: string
}


const StartStrategyModal: React.FC<StartStrategyModalProps> = (props: StartStrategyModalProps) => {
  const {goals, hasStartedOtherStrategy, isShown, onSubmit, strategyId, ...modalProps} = props

  const {email: userEmail, gender, name} = useSelector(
    ({user: {profile = {}}}: RootState): bayes.bob.UserProfile => profile,
    (profileA: bayes.bob.UserProfile, profileB: bayes.bob.UserProfile): boolean =>
      profileA.name === profileB.name && profileA.gender === profileB.gender &&
      profileA.email === profileB.email,
  )
  const isWorking = useSelector(({asyncState: {isFetching}}: RootState): boolean =>
    !!isFetching['EMAIL_CHECK'] || !!isFetching['AUTHENTICATE_USER'])

  const [isEmailRequired] = useState(config.isCoachingEnabled && !userEmail)
  const [isEmailInvalid, setEmailInvalid] = useState(false)
  const [isEmailAlreadyUsed, setEmailAlreadyUsed] = useState(false)
  const [email, setEmail] = useState('')

  const {t} = useTranslation()
  const inputRef = useRef<Inputable>(null)
  const dispatch = useDispatch<DispatchAllActions>()
  const submit = useCallback(async (): Promise<void> => {
    if (!config.isCoachingEnabled || userEmail) {
      onSubmit()
      return
    }
    if (!validateEmail(email)) {
      setEmailInvalid(true)
      inputRef.current && inputRef.current.focus()
      return
    }
    const checkedEmail = await dispatch(emailCheck(email))
    if (!checkedEmail) {
      return
    }
    if (!checkedEmail.isNewUser) {
      setEmailAlreadyUsed(true)
      return
    }
    if (await dispatch(silentlySetupCoaching(email))) {
      onSubmit()
    }
  }, [dispatch, onSubmit, email, userEmail])
  useFastForward((): void => {
    if (userEmail || email) {
      submit()
      return
    }
    setEmail(getUniqueExampleEmail())
  }, [email, submit, userEmail])
  const title = hasStartedOtherStrategy ?
    t('On ne vous arrête plus\u00A0!\u00A0💪') : t("C'est le moment de passer à l'action\u00A0👍")
  useEffect(() => {
    if (isShown && !isMobileVersion) {
      inputRef.current && inputRef.current.focus()
    }
  }, [isShown])
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  return <Modal {...modalProps} title={title} isShown={isShown}>
    <div style={startStrategyModalStyle}>
      {hasStartedOtherStrategy ? null : <Trans parent={null} tOptions={tOptions}>
        Bravo {{name}}, vous êtes prêt·e à vous lancer.{' '}
      </Trans>}
      <Trans parent={null}>
      Vous allez commencer un {{new: hasStartedOtherStrategy ? t('nouveau ') : null}}
      programme qui va vous aider à&nbsp;:
      </Trans>
      <ul>
        {goals.map(({stepTitle}, index): React.ReactElement => <li key={index}>
          {stepTitle}
        </li>)}
      </ul>
      {isEmailRequired ? <div>
        <Trans>
          Saisissez l'adresse à laquelle vous voulez recevoir les emails
          d'accompagnement&nbsp;:
        </Trans>
        <form style={startStrategyModalInputStyle} onSubmit={submit}>
          <Input
            type="email" placeholder={t('Saisissez votre email ici')}
            value={email} onChange={setEmail} ref={inputRef}
            name="email" style={isEmailInvalid ? errorStyle : undefined} />
        </form>
        {isEmailAlreadyUsed ? <Trans style={alreadyUsedWarningStyle}>
          Cet email est déjà lié à un compte, <LoginLink
            email={email} isSignUp={false} visualElement="start-strategy">
            connectez-vous
          </LoginLink> pour continuer.
        </Trans> : null}
      </div> : null}
      {strategyId.startsWith('interview-success') ? <Trans style={covidWarningStyle}>
        Nous savons que certains points de ce programme seront compliqués avec le confinement.
        {' '}<ExternalLink href={Routes.COVID_PAGE} style={blueLinkStyle}>
          Retrouvez-ici nos conseils
        </ExternalLink> pour avancer sur votre recherche, tout en restant à la maison.
      </Trans> : null}
      <div style={startStrategyModalSubmitButtonStyle}>
        <Button onClick={submit} type="validation" isProgressShown={isWorking}>
          {isEmailRequired ? t('Valider') : t("C'est parti\u00A0!")}
        </Button>
      </div>
    </div>
  </Modal>
}


interface StrategiesProps {
  isAnimationEnabled?: boolean
  isCollapsed?: boolean
  makeStrategyLink?: (strategyId: string) => string
  project: bayes.bob.Project
  strategies?: readonly bayes.bob.Strategy[]
  strategyStyle?: React.CSSProperties
  titleStyle?: React.CSSProperties
}

interface StrategiesListProps extends StrategiesProps {
  title: LocalizableString
}

const strategiesStyle = {
  marginBottom: 40,
}

const StrategiesListBase: React.FC<StrategiesListProps> = (props): React.ReactElement|null => {
  const {isAnimationEnabled, isCollapsed, makeStrategyLink, project, strategies, strategyStyle,
    title, titleStyle} = props
  const {t, t: translate} = useTranslation()
  const combinedStrategyStyle = useMemo(() => ({
    alignSelf: 'stretch',
    margin: '0 0 20px',
    ...strategyStyle,
  }), [strategyStyle])
  const [isShown, setIsShown] = useState(!isCollapsed)
  const show = useCallback((): void => setIsShown(true), [])
  const hasStartedOneStrategy = useMemo(
    () => (strategies || []).filter(isValidStrategy).some((strategy): boolean =>
      getStrategyCompletion(project, strategy.strategyId).isStarted),
    [project, strategies],
  )
  if (!strategies || !strategies.length) {
    return null
  }
  if (!isShown) {
    return <button onClick={show}>
      {t('+ Afficher plus de stratégies')}
    </button>
  }
  const translatedTitle = translate(...combineTOptions(title, {count: strategies.length}))
  return <div style={strategiesStyle}>
    <h2 style={titleStyle}>{translatedTitle}</h2>
    <AppearingList isAnimationEnabled={isAnimationEnabled}>
      {strategies.filter(isValidStrategy).
        map((strategy, index): ReactStylableElement => <StrategyListItem
          key={strategy.strategyId} style={combinedStrategyStyle} strategy={strategy}
          strategyCompletion={getStrategyCompletion(project, strategy.strategyId)}
          strategyUrl={makeStrategyLink && makeStrategyLink(strategy.strategyId)}
          hasStartedOtherStrategy={hasStartedOneStrategy} rank={index} project={project} />)}
    </AppearingList>
  </div>
}
StrategiesListBase.propTypes = {
  isAnimationEnabled: PropTypes.bool,
  isCollapsed: PropTypes.bool,
  makeStrategyLink: PropTypes.func,
  project: PropTypes.object.isRequired,
  strategies: PropTypes.arrayOf(PropTypes.shape({
    strategyId: PropTypes.string,
  })),
  strategyStyle: PropTypes.object,
  title: PropTypes.array.isRequired,
  titleStyle: PropTypes.object,
}
const StrategiesList = React.memo(StrategiesListBase)

type StrategyClass = 'complete' | 'started' | 'main' | 'other'
type StrategyClasses = {[className in StrategyClass]: readonly bayes.bob.Strategy[]}

const StrategiesBase: React.FC<StrategiesProps> = (props: StrategiesProps): React.ReactElement => {
  const {project, strategies, titleStyle} = props
  const isConvincePageEnabled = useAlwaysConvincePage()
  const classifiedStrategies = useMemo((): StrategyClasses =>
    _groupBy<bayes.bob.Strategy>(strategies, ({isSecondary, strategyId}): StrategyClass => {
      if (strategyId) {
        const {isComplete, isStarted} = getStrategyCompletion(project, strategyId)
        if (isComplete) {
          return 'complete'
        }
        if (isStarted) {
          return 'started'
        }
      }
      return isSecondary ? 'other' : 'main'
    // TODO(cyrille): See if @types/lodash.Dictionary can have an explicit key type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }) as unknown as StrategyClasses, [project.openedStrategies, strategies])
  const blueTitleStyle = useMemo((): React.CSSProperties => ({
    ...titleStyle,
    color: colors.BOB_BLUE,
  }), [titleStyle])
  return <React.Fragment>
    <StrategiesList
      {...props}
      strategies={classifiedStrategies['started']}
      title={prepareT('Stratégie en cours', {count: 0})}
      titleStyle={blueTitleStyle} />
    <StrategiesList
      {...props}
      strategies={classifiedStrategies['main']}
      title={prepareT('Stratégie prioritaire', {count: 0})} />
    <StrategiesList
      {...props}
      strategies={classifiedStrategies['other']}
      title={prepareT('Autre stratégie', {count: 0})}
      isCollapsed={!isMobileVersion && isConvincePageEnabled} />
    <StrategiesList
      {...props}
      strategies={classifiedStrategies['complete']}
      title={prepareT('Stratégie terminée', {count: 0})} />
  </React.Fragment>
}
StrategiesBase.propTypes = {
  project: PropTypes.shape({
    openedStrategies: PropTypes.arrayOf(PropTypes.shape({
      strategyId: PropTypes.string.isRequired,
    }).isRequired),
  }).isRequired,
  strategies: PropTypes.arrayOf(PropTypes.shape({
    strategyId: PropTypes.string,
  })).isRequired,
}
const Strategies = React.memo(StrategiesBase)

const LEFT_PANEL_WIDTH = 600

const RIGHT_PANEL_WIDTH = 295

const StrategySectionBase = (props: Omit<StratPanelProps, 'ref'>): React.ReactElement => {
  const {children, style, title, ...otherProps} = props
  const sectionStyle = useMemo((): React.CSSProperties => ({
    marginBottom: 60,
    maxWidth: LEFT_PANEL_WIDTH,
    ...style,
  }), [style])
  return <StratPanel style={sectionStyle} {...otherProps} title={title}>
    {children}
  </StratPanel>
}
StrategySectionBase.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
  title: PropTypes.string.isRequired,
}
const StrategySection = React.memo(StrategySectionBase)


interface GoalsSelectionEditorProps {
  goals: readonly StrategyGoal[]
  onSubmit: (reachedGoals: {[key: string]: boolean}) => void
  readonly reachedGoals?: {[key: string]: boolean}
  style?: React.CSSProperties
}


const emptyObject = {} as const
const emptyArray = [] as const


const GoalsSelectionEditorBase = (props: GoalsSelectionEditorProps): React.ReactElement => {
  const {goals, onSubmit, reachedGoals = emptyObject, style} = props

  const selectedGoals = useMemo(
    (): readonly string[] =>
      Object.keys(reachedGoals).filter((goalId: string): boolean => reachedGoals[goalId]),
    [reachedGoals],
  )

  const itemStyle = useCallback((index: number): React.CSSProperties => isMobileVersion ? {
    borderTop: index ? `1px solid ${colors.MODAL_PROJECT_GREY}` : 'none',
    margin: '0 -20px 0 0',
    padding: '25px 30px 25px 0',
  } : {
    marginBottom: 10,
  }, [])

  const selectGoals = useCallback((selectedGoals: readonly string[]): void => {
    const selectedGoalsSet = new Set(selectedGoals)
    const reachedGoals =
      _fromPairs(goals.map(({goalId}): [string, boolean] => [goalId, selectedGoalsSet.has(goalId)]))
    onSubmit(reachedGoals)
  }, [goals, onSubmit])

  useFastForward((): void => {
    selectGoals(goals.
      filter((): boolean => Math.random() > .5).
      map(({goalId}): string => goalId))
  }, [goals, selectGoals])

  const options = goals.map(({content, goalId}): {name: React.ReactNode; value: string} => ({
    name: <Markdown content={content} isSingleLine={true} />,
    value: goalId,
  }))
  const containerStyle: React.CSSProperties = {
    fontSize: 15,
    padding: isMobileVersion ? 0 : '35px 50px',
    ...style,
  }
  const selectedItemStyle = isMobileVersion ? {
    color: colors.COOL_GREY,
  } : undefined
  return <div style={containerStyle}>
    <CheckboxList
      onChange={selectGoals} options={options} values={selectedGoals}
      checkboxStyle={itemStyle}
      selectedCheckboxStyle={selectedItemStyle} />
  </div>
}
GoalsSelectionEditorBase.propTypes = {
  goals: PropTypes.array.isRequired,
  onSubmit: PropTypes.func.isRequired,
  reachedGoals: PropTypes.objectOf(PropTypes.bool),
  style: PropTypes.object,
}
const GoalsSelectionEditor = React.memo(GoalsSelectionEditorBase)


const mobileSectionHeaderStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 11,
  fontWeight: 'bold',
  textTransform: 'uppercase',
}
const progressStyle: React.CSSProperties = {
  ...strategyCardStyle,
  alignItems: 'center',
  borderRadius: 10,
  display: 'flex',
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 25,
}
const calendarStyle: React.CSSProperties = {
  borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
  fontSize: 11,
  fontStyle: 'italic',
  margin: '0 -20px -20px',
  padding: '25px 20px',
  textAlign: 'center',
}
const coachingStyle = {
  alignItems: 'center',
  display: 'flex',
  fontSize: 14,
  marginBottom: 15,
  padding: '20px 0',
  width: '100%',
}


interface GoalsSelectionTabProps extends bayes.bob.WorkingStrategy, GoalsSelectionEditorProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
}


const GoalsSelectionTabBase = (props: GoalsSelectionTabProps): React.ReactElement => {
  const {coachingEmailFrequency, goals, lastModifiedAt, reachedGoals = {}, startedAt, onSubmit,
    ...otherProps} = props
  const [isModalShown, showModal, hideModal] = useModal()
  const {t, t: translate} = useTranslation()

  const percent = Math.round(getStrategyProgress(goals, reachedGoals))
  const {name: coaching = ''} =
    FOLLOWUP_EMAILS_OPTIONS.find(({value}): boolean => value === coachingEmailFrequency) || {}
  return <React.Fragment>
    <CoachingModal isShown={isModalShown} onClose={hideModal} />
    <div style={progressStyle}>
      <div style={{flex: 1}}>
        {t("État de l'objectif")}
        <PercentBar
          color={colors.GREENISH_TEAL} height={6} percent={percent}
          style={{marginTop: 10}} isPercentShown={false} />
      </div>
      <div style={{fontSize: 22, marginLeft: 25}}>{percent}%</div>
    </div>
    <section>
      <header style={mobileSectionHeaderStyle}>{t('Mon coaching')}</header>
      <button style={coachingStyle} onClick={showModal}>
        <div style={{flex: 1}}>{t('Type de coaching')}</div>
        <div style={{fontStyle: 'italic', fontWeight: 'bold', margin: 10}}>{
          coaching && translate(...coaching) || t('Désactivé')
        }</div>
        <ChevronRightIcon size={20} color={colors.COOL_GREY} />
      </button>
    </section>
    <section>
      <header style={mobileSectionHeaderStyle}>Mes objectifs</header>
      <GoalsSelectionEditor
        {...otherProps}
        {...{goals, onSubmit, reachedGoals}} />
      {startedAt ? <div style={calendarStyle}>
        {t('Commencé le {{date}}', {date: getDateString(startedAt, t)})}<br />
        {lastModifiedAt ?
          t('Dernière modification {{todayOrXDaysAgo}}', {
            todayOrXDaysAgo: getDiffBetweenDatesInString(new Date(lastModifiedAt), new Date(), t),
          }) : null}
      </div> : null}
    </section>
  </React.Fragment>
}
GoalsSelectionTabBase.propTypes = {
  onSubmit: PropTypes.func.isRequired,
}
const GoalsSelectionTab = React.memo(GoalsSelectionTabBase)


interface MethodProps {
  advice: bayes.bob.Advice & {adviceId: string}
  style?: React.CSSProperties
}
// TODO(cyrille): Rename.
const ObservationMethodBase = (props: MethodProps): React.ReactElement => {
  const {advice, advice: {adviceId}, style} = props
  const {t} = useTranslation()
  const containerStyle = useMemo((): React.CSSProperties => ({
    ...strategyCardStyle,
    fontSize: 13,
    fontWeight: 'bold',
    height: 190,
    padding: '20px 15px',
    textAlign: 'center',
    width: 140,
    ...style,
  }), [style])
  return <div style={containerStyle}>
    <AdvicePicto adviceId={adviceId} style={{marginBottom: 20, width: 64}} />
    <div>{upperFirstLetter(getAdviceGoal(advice, t))}</div>
  </div>
}
const ObservationMethod = React.memo(ObservationMethodBase)


interface StratPanelProps extends React.HTMLProps<HTMLDivElement> {
  title: string
}


const stratPanelTitleStyle: React.CSSProperties = isMobileVersion ? {
  fontSize: 22,
  margin: '0 0 15px',
} : {
  borderBottom: strategyCardStyle.border,
  fontSize: 22,
  margin: '0 0 25px',
  paddingBottom: 20,
}


const StratPanelBase = (props: StratPanelProps): React.ReactElement => {
  const {children, title, ...otherProps} = props
  return <section {...otherProps}>
    <h2 style={stratPanelTitleStyle}>{title}</h2>
    {children}
  </section>
}
const StratPanel = React.memo(StratPanelBase)


interface TabProps {
  baseUrl: string
  children: React.ReactNode
  icon: string
  selectedIcon: string
  shownTab?: string
  style?: React.CSSProperties
  tab: string
}

const MobileTabBase = (props: TabProps): React.ReactElement => {
  const {baseUrl, children, icon, selectedIcon, shownTab, style, tab} = props
  const isSelected = shownTab === tab
  const tabStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    color: isSelected ? colors.BOB_BLUE : colors.COOL_GREY,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    textDecoration: 'none',
    ...style,
  }), [isSelected, style])
  return <Link to={`${baseUrl}/${tab}`} style={tabStyle}>
    <img src={isSelected ? selectedIcon : icon} alt="" style={{marginBottom: 3}} />
    {children}
  </Link>
}
const MobileTab = React.memo(MobileTabBase)


interface MethodsListProps {
  isRead?: boolean
  methods: readonly [ValidAdvice, string|undefined][]
  strategyUrl: string
}


const MethodsListBase = (props: MethodsListProps): React.ReactElement|null => {
  const {methods, isRead, strategyUrl} = props
  const {t} = useTranslation()
  if (!methods.length) {
    return null
  }
  const adviceStyle = (index: number): React.CSSProperties => ({
    alignItems: 'center',
    borderTop: index ? `1px solid ${colors.MODAL_PROJECT_GREY}` : 'none',
    color: 'inherit',
    display: 'flex',
    fontSize: 14,
    fontWeight: isRead ? 'initial' : 'bold',
    padding: '20px 15px 20px 0',
    textDecoration: 'none',
  })
  const count = methods.length
  return <section>
    <header style={mobileSectionHeaderStyle}>{
      // i18next-extract-mark-plural-next-line disable
      isRead ? t('Consultée', {count}) : t('Non consultée', {count})
    }</header>
    <div style={{marginRight: -20}}>
      {methods.map(([{adviceId}, teaser], index): React.ReactNode =>
        <Link
          to={`${strategyUrl}/${adviceId}`} key={adviceId}
          style={adviceStyle(index)}>
          <AdvicePicto adviceId={adviceId} style={{marginRight: 15}} />
          <div style={{flex: 1}}>{teaser}</div>
          <ChevronRightIcon
            style={{flex: 'none', marginLeft: 10}} size={20} color={colors.COOL_GREY} />
        </Link>)}
    </div>
  </section>
}
const MethodsList = React.memo(MethodsListBase)


const useStrategyMethods = (
  {advices = emptyArray}: bayes.bob.Project,
  {piecesOfAdvice = emptyArray}: bayes.bob.Strategy,
  t: TFunction,
): readonly [ValidAdvice, string][] => {
  return useMemo((): readonly [ValidAdvice, string][] => {
    const validAdvices =
      advices.filter((a: bayes.bob.Advice): a is ValidAdvice => a && !!a.adviceId)
    const advicesById = _keyBy(validAdvices, 'adviceId')
    return piecesOfAdvice.
      filter((a): a is ValidStrategyAdvice => !!(a.adviceId && advicesById[a.adviceId])).
      map(({adviceId, teaser}): [ValidAdvice, string] => [
        advicesById[adviceId],
        upperFirstLetter(teaser || getAdviceGoal(advicesById[adviceId], t)),
      ])
  }, [advices, piecesOfAdvice, t])
}


interface MobileStrategyPageProps {
  onSelectGoals: (reachedGoals: {[key: string]: boolean}) => void
  openedStrategy: bayes.bob.WorkingStrategy & {
    startedAt: string
    strategyId: string
  }
  project: bayes.bob.Project
  projectUrl: string
  shownTab?: string
  strategy: bayes.bob.Strategy & {strategyId: string}
  strategyUrl: string
}


const MobileStrategyPageBase = (props: MobileStrategyPageProps): React.ReactElement => {
  const {onSelectGoals, openedStrategy, project, projectUrl,
    shownTab, strategy, strategy: {strategyId, title}, strategyUrl} = props
  const {t} = useTranslation()
  const coachingEmailFrequency = useSelector(
    ({user: {profile: {coachingEmailFrequency} = {}}}: RootState):
    bayes.bob.EmailFrequency|undefined => coachingEmailFrequency,
  )
  const goals = getStrategyGoals(strategyId, t)
  const methods = useStrategyMethods(project, strategy, t)
  const {false: unreadMethods = emptyArray, true: readMethods = emptyArray} =
    _groupBy(methods, ([{status}]): boolean => status === 'ADVICE_READ')
  const pageStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    paddingBottom: 60,
  }
  const navStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: 'inherit',
    borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
    bottom: 0,
    display: 'flex',
    fontSize: 13,
    height: 60,
    justifyContent: 'center',
    left: 0,
    position: 'fixed',
    right: 0,
  }
  const tabStyle = {
    height: '100%',
    width: '25%',
  }
  return <PageWithNavigationBar
    style={pageStyle} navBarContent={title} onBackClick={projectUrl}>
    <div style={{flex: 1, padding: 20}}>
      <Switch>
        <Route path={`${strategyUrl}/objectifs`}>
          <GoalsSelectionTab
            goals={goals} {...openedStrategy}
            coachingEmailFrequency={coachingEmailFrequency}
            onSubmit={onSelectGoals} />
        </Route>
        <Route path={`${strategyUrl}/methodes`}>
          <MethodsList methods={unreadMethods} strategyUrl={strategyUrl} />
          <MethodsList methods={readMethods} isRead={true} strategyUrl={strategyUrl} />
        </Route>
        <Redirect to={`${strategyUrl}/objectifs`} />
      </Switch>
    </div>
    <div style={navStyle}>
      <MobileTab
        tab="objectifs" icon={goalsIcon} selectedIcon={selectedGoalsIcon} style={tabStyle}
        baseUrl={strategyUrl} shownTab={shownTab}>
        {t('Objectifs')}
      </MobileTab>
      <MobileTab
        tab="methodes" baseUrl={strategyUrl} shownTab={shownTab} style={tabStyle}
        icon={methodsIcon} selectedIcon={selectedMethodsIcon}>
        {t('Méthodes')}
      </MobileTab>
    </div>
  </PageWithNavigationBar>
}
const MobileStrategyPage = React.memo(MobileStrategyPageBase)


interface DesktopStrategyPageProps {
  onSelectGoals: (reachedGoals: {[key: string]: boolean}) => void
  openedStrategy: bayes.bob.WorkingStrategy & {
    startedAt: string
    strategyId: string
  }
  project: bayes.bob.Project
  projectUrl: string
  strategy: bayes.bob.Strategy & {strategyId: string}
}


const DesktopStrategyPageBase = (props: DesktopStrategyPageProps): React.ReactElement|null => {
  const {onSelectGoals, openedStrategy, project, projectUrl,
    strategy, strategy: {isPrincipal, strategyId, title}} = props
  const {t} = useTranslation()
  const {startedAt} = openedStrategy
  const methods = useStrategyMethods(project, strategy, t)
  const titleStyle: React.CSSProperties = {
    fontSize: 33,
    marginBottom: 10,
    marginTop: 50,
  }
  const contentStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    margin: '0 auto',
    maxWidth: 1000,
    padding: 20,
  }
  const dateStyle: React.CSSProperties = {
    fontSize: 11,
    fontStyle: 'italic',
    marginLeft: 10,
  }
  const navBarContainerStyle: React.CSSProperties = {
    alignItems: 'center',
    bottom: 0,
    display: 'flex',
    left: 30,
    margin: 'auto 0',
    position: 'absolute',
    top: 0,
  }
  const navBarLinkStyle: React.CSSProperties = {
    alignItems: 'center',
    color: 'inherit',
    display: 'flex',
    fontWeight: 'bold',
    textDecoration: 'none',
  }
  return <PageWithNavigationBar
    page="strategie" navBarContent={<div style={navBarContainerStyle}>
      <Link to={projectUrl} style={navBarLinkStyle}>
        <ArrowLeftIcon size={24} style={{marginRight: 25}} />{t('Diagnostic')}
      </Link>
    </div>} isLogoShown={false}
    onBackClick={projectUrl} style={{backgroundColor: '#fff'}}>
    <header
      style={{margin: '0 auto 35px', maxWidth: 1000, padding: '0 20px'}}>
      <h1 style={titleStyle}>{title}</h1>
      <div style={{alignItems: 'center', display: 'flex'}}>
        <WhyButton strategy={strategy} />
        <Trans style={dateStyle}>Commencé le {{date: getDateString(startedAt, t)}}</Trans>
      </div>
    </header>
    <div style={contentStyle}>
      <div style={{flex: 1}}>
        {/* TODO(cyrille): Replace the goals panel on mobile by new mobile UI. */}
        <StrategySection title={t('Méthodes')}>
          {methods.map(([advice, teaser], index): React.ReactNode => <WorkingMethod
            key={advice.adviceId} style={{marginTop: index ? 60 : 25}} title={teaser}
            {...{advice, project, strategyId}} />)}
        </StrategySection>
      </div>
      <GoalsPanel
        style={{flex: 'none', width: RIGHT_PANEL_WIDTH}} project={project}
        onChange={onSelectGoals} openedStrategy={openedStrategy}
        isPrincipal={!!isPrincipal} />
    </div>
  </PageWithNavigationBar>
}
const DesktopStrategyPage = React.memo(DesktopStrategyPageBase)


export interface StrategyPageParams {
  adviceId?: string
  strategyId?: string
}


interface StrategyPageProps {
  project: bayes.bob.Project
  projectUrl: string
  strategy: bayes.bob.Strategy & {strategyId: string}
  strategyRank: number
  strategyUrl: string
}

type ValidWorkingStrategy = ReturnType<typeof getStartedStrategy>

function isStrategyStarted(s: ValidWorkingStrategy):
  s is ValidWorkingStrategy & {startedAt: string} {
  return !!s.startedAt
}

const StrategyPageBase = (props: StrategyPageProps): React.ReactElement => {
  const {project, projectUrl, strategy, strategy: {strategyId}, strategyRank, strategyUrl} = props
  const dispatch = useDispatch<DispatchAllActions>()
  const openedStrategy = getStartedStrategy(project, strategyId)

  const isStarted = isStrategyStarted(openedStrategy)

  useEffect((): void => {
    if (isStarted) {
      dispatch(strategyWorkPageIsShown(project, strategy, strategyRank))
    }
    // No need to dispatch when the strategy or project change, only if it's an entirely different
    // strategy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isStarted, project.projectId, strategyId, strategyRank])

  const handleGoalsSelection = useCallback((reachedGoals: {[goalId: string]: boolean}): void => {
    const workingStrategy = {
      ...openedStrategy,
      reachedGoals,
      strategyId,
    }
    if (!isStarted) {
      dispatch(startStrategy(project, workingStrategy, strategyRank))
    }
    if (!_isEqual(openedStrategy, workingStrategy)) {
      dispatch(replaceStrategy(project, workingStrategy))
    }
  }, [dispatch, isStarted, openedStrategy, project, strategyId, strategyRank])

  const {adviceId} = useParams<{adviceId: string}>()

  if (!isStrategyStarted(openedStrategy)) {
    return <Redirect to={projectUrl} />
  }

  if (isMobileVersion) {
    return <MobileStrategyPage
      {...{project, projectUrl, strategy, strategyUrl}} openedStrategy={openedStrategy}
      shownTab={adviceId}
      onSelectGoals={handleGoalsSelection} />
  }

  if (adviceId) {
    return <Redirect to={strategyUrl} />
  }

  return <DesktopStrategyPage
    {...{project, projectUrl, strategy}} openedStrategy={openedStrategy}
    onSelectGoals={handleGoalsSelection} />
}
StrategyPageBase.propTypes = {
  project: PropTypes.shape({
    advices: PropTypes.array.isRequired,
    projectId: PropTypes.string,
  }).isRequired,
  projectUrl: PropTypes.string.isRequired,
  strategy: PropTypes.shape({
    piecesOfAdvice: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired),
    strategyId: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
  strategyRank: PropTypes.number.isRequired,
}
type ValidStrategyAdvice = bayes.bob.StrategyAdvice & {adviceId: string}
const StrategyPage = React.memo(StrategyPageBase)


export {Strategies, StrategyPage, ObservationMethod}
