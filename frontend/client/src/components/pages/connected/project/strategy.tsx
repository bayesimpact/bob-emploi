import {TOptions} from 'i18next'
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
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {WithTranslation, useTranslation, withTranslation} from 'react-i18next'
import {connect, useDispatch, useSelector} from 'react-redux'
import {Route, RouteComponentProps, Switch} from 'react-router'
import {Link, Redirect, useHistory} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, displayToasterMessage, emailCheck, setUserProfile,
  silentlySetupCoaching, startStrategy, replaceStrategy, stopStrategy, strategyWorkPageIsShown,
} from 'store/actions'
import {ValidAdvice, getAdviceGoal} from 'store/advice'
import {StrategyGoal, StrategyTestimonial, getDateString,
  getDiffBetweenDatesInString, getStrategyGoals, getStrategiesTestimonials,
  upperFirstLetter} from 'store/french'
import {LocalizableString, prepareT} from 'store/i18n'
import {impactFromPercentDelta} from 'store/score'
import {StrategyCompletion, getStartedStrategy, getStrategyCompletion,
  getStrategyProgress, isValidStrategy} from 'store/strategy'
import {getUniqueExampleEmail, useGender} from 'store/user'
import {validateEmail} from 'store/validations'

import {AdvicePicto, WorkingMethod} from 'components/advisor'
import {FastForward} from 'components/fast_forward'
import {Trans} from 'components/i18n'
import {LoginLink} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig, useModal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {CheckboxList} from 'components/pages/connected/form_utils'
import {CoachingConfirmationModal} from 'components/pages/connected/coaching_modal'
import {RadiumDiv, SmartLink} from 'components/radium'
import {AppearingList, Button, FastTransitions, GrowingNumber, Input, LabeledToggle,
  Markdown, PercentBar, PieChart, Tag, colorToAlpha} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'
import goalsIcon from 'images/goals-icon.svg'
import selectedGoalsIcon from 'images/goals-icon-selected.svg'
import methodsIcon from 'images/methods-icon.svg'
import selectedMethodsIcon from 'images/methods-icon-selected.svg'

import {BobModal} from './speech'

// TODO(cyrille): Move to store.
interface FollowupOption {
  description: LocalizableString
  name: LocalizableString
  value: bayes.bob.EmailFrequency
}

const FOLLOWUP_EMAILS_OPTIONS: Readonly<FollowupOption[]> = [
  {
    description: prepareT('Un email pour vous booster une fois par mois'),
    name: prepareT('Occasionel'),
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
  onClick: () => void
  style: RadiumCSSProperties
}

class CoachingOption extends React.PureComponent<CoachingOptionProps> {
  public render(): React.ReactNode {
    const {description, isSelected, name, onClick, style} = this.props
    const selectedStyle = {
      backgroundColor: colorToAlpha(colors.BOB_BLUE, .09),
      border: `2px solid ${colors.BOB_BLUE}`,
    }
    const optionStyle = {
      ':hover': selectedStyle,
      ...isSelected && selectedStyle,
      'alignItems': 'center',
      'border': `2px solid ${colorToAlpha(colors.BOB_BLUE, 0)}`,
      'borderRadius': 10,
      'boxShadow': '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
      'cursor': 'pointer',
      'display': 'flex',
      'padding': '20px 25px',
      ...FastTransitions,
      ...style,
    }
    const descriptionStyle = {
      color: colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      lineHeight: '19px',
    }
    return <RadiumDiv onClick={onClick} style={optionStyle}>
      <LabeledToggle
        style={{marginBottom: 0}}
        label={<div style={{marginLeft: 10}}>
          <h3 style={{fontSize: 18, margin: 0}}>{name}</h3>
          <div style={descriptionStyle}>{description}</div>
        </div>}
        isSelected={isSelected} type="radio" />
    </RadiumDiv>
  }
}


interface CoachingModalConnectedProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  isRegistrationNeeded: boolean
}

interface CoachingModalProps extends
  Omit<ModalConfig, 'children'>, CoachingModalConnectedProps, WithTranslation {
  children?: never
  dispatch: DispatchAllActions
}

interface CoachingModalState {
  frequency?: bayes.bob.EmailFrequency
  isShown?: boolean
}

// TODO(cyrille): Make it a full-page on mobile.
class CoachingModalBase
  extends React.PureComponent<CoachingModalProps, CoachingModalState> {
  public state: CoachingModalState = {}

  public static getDerivedStateFromProps(
    {coachingEmailFrequency, isShown}: CoachingModalProps,
    {isShown: wasShown}: CoachingModalState): CoachingModalState |null{
    if (!isShown === !wasShown) {
      return null
    }
    return {
      ...isShown && {
        frequency: coachingEmailFrequency,
      },
      isShown,
    }
  }

  private handleClickOption = _memoize((frequency): (() => void) => (): void =>
    this.setState({frequency}))

  private handleCloseRegistrationModal = (): void => {
    const {dispatch, t} = this.props
    dispatch(setUserProfile(
      {coachingEmailFrequency: undefined}, true, 'FINISH_PROFILE_SETTINGS')).
      then((): void => {
        dispatch(displayToasterMessage(t('Le coaching a été annulé')))
      })
  }

  private handleConfirm = (): void => {
    const {dispatch, onClose, t} = this.props
    const {frequency: coachingEmailFrequency} = this.state
    // TODO(cyrille): Change action to something specific remembering the strategy.
    dispatch(setUserProfile({coachingEmailFrequency}, true, 'FINISH_PROFILE_SETTINGS')).
      then((success): void => {
        if (success) {
          onClose && onClose()
          dispatch(displayToasterMessage(t('Modifications sauvegardées.')))
        }
      })
  }

  public render(): React.ReactNode {
    const {coachingEmailFrequency, isRegistrationNeeded, isShown, onClose, t} = this.props
    const {frequency} = this.state
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
        onCloseModal={this.handleCloseRegistrationModal} /> : null}
      <Modal
        isShown={isShown} onClose={onClose} style={{margin: 20}}
        title={t('Choisissez le coaching qui vous convient')}>
        <div style={contentStyle}>
          {FOLLOWUP_EMAILS_OPTIONS.map(({description, name, value, ...option}): React.ReactNode =>
            <CoachingOption
              {...option} isSelected={frequency === value}
              // i18next-extract-disable-next-line
              description={t(description)} name={t(name)}
              onClick={this.handleClickOption(value)}
              key={value} style={{marginBottom: 20}} />)}
          <div style={buttonsStyle}>
            <Button isRound={true} type="back" style={{marginRight: 15}} onClick={onClose}>
              {t('Annuler')}
            </Button>
            <Button isRound={true} disabled={!frequency} onClick={this.handleConfirm}>
              {t('Continuer')}
            </Button>
          </div>
        </div>
      </Modal>
    </React.Fragment>
  }
}
const CoachingModal = connect(
  ({user: {hasAccount, profile: {coachingEmailFrequency, email} = {}}}: RootState):
  CoachingModalConnectedProps => ({
    coachingEmailFrequency,
    isRegistrationNeeded: !hasAccount && !email,
  }))(withTranslation()(CoachingModalBase))


interface SelectedCoachingConnectedProps {
  frequency?: bayes.bob.EmailFrequency
}

interface SelectCoachingProps extends SelectedCoachingConnectedProps, WithTranslation {
  onClick?: () => void
  style?: RadiumCSSProperties
}

class SelectCoachingBase extends React.PureComponent<SelectCoachingProps> {
  public render(): React.ReactNode {
    const {frequency, style, onClick, t} = this.props
    if (!frequency || frequency === 'EMAIL_NONE' || frequency === 'UNKNOWN_EMAIL_FREQUENCY') {
      return <Button
        onClick={onClick}
        isRound={true} style={{display: 'block', ...style}}>
        {t('Activer le coaching de {{productName}}', {productName: config.productName})}
      </Button>
    }
    const containerStyle: RadiumCSSProperties = {
      ...strategyCardStyle,
      ':hover': {
        border: `2px solid ${colors.COOL_GREY}`,
      },
      'alignItems': 'center',
      ...!!onClick && {cursor: 'pointer'},
      'display': 'flex',
      'padding': '20px 25px',
      ...style,
    }
    const headerStyle = {
      color: colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      lineHeight: '19px',
    }
    const nameStyle: React.CSSProperties = {
      fontSize: 18,
      fontWeight: 'bold',
    }
    const {name} = FOLLOWUP_EMAILS_OPTIONS.find(({value}): boolean => value === frequency) || {}
    return <RadiumDiv onClick={onClick} style={containerStyle}>
      <div style={{flex: 1}}>
        <div style={headerStyle}>{t('Type de coaching\u00A0:')}</div>
        {/* i18next-extract-disable-next-line */}
        <div style={nameStyle}>{t(name || '')}</div>
      </div>
      <ChevronDownIcon size={24} />
    </RadiumDiv>
  }
}
const SelectCoaching = connect(({user: {
  profile: {coachingEmailFrequency: frequency} = {},
}}: RootState):
SelectedCoachingConnectedProps => ({frequency}))(withTranslation()(SelectCoachingBase))


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
  color: colors.GREENISH_TEAL,
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
  const dispatch = useDispatch()
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
        percentage={progress} style={goalsPieChartStyle}>
        <span style={goalsGrowingNumberStyle}>
          <GrowingNumber isSteady={true} number={progress} />%
        </span>
      </PieChart>
      <GoalsSelectionEditor
        shouldSubmitOnChange={true} onSubmit={onChange} style={goalsSelectionEditorStyle}
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
  padding: '30px 30px 30px 40px',
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
    strategy: {isPrincipal, description, score, strategyId, title},
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
  const dispatch = useDispatch()
  const history = useHistory()
  const redirectToStratPage = useCallback(() => {
    dispatch(startStrategy(project, {strategyId}, rank))
    dispatch(replaceStrategy(project, {strategyId}))
    if (strategyUrl) {
      history.push(strategyUrl)
    }
  }, [dispatch, history, project, rank, strategyId, strategyUrl])
  const {color} = impactFromPercentDelta(score || 0)
  return <SmartLink to={isStarted ? strategyUrl : undefined} style={containerStyle}>
    <StartStrategyModal
      isShown={isModalShown} onClose={hideModal} onSubmit={redirectToStratPage}
      hasStartedOtherStrategy={hasStartedOtherStrategy} goals={goals} />
    <div style={contentStyle}>
      <div>
        <div style={titleStyle}>{title}</div>
        <div>Impact&nbsp;: <span style={getImpactStyle(color)}>+&nbsp;{score}%</span></div>
      </div>
      {isPrincipal ? <Tag style={tagStyle}>{t('Priorité')}</Tag> : null}
      <div style={flexFillerStyle} />
      {isComplete ? <CheckIcon style={completedStyle} size={30} /> : null}
      {strategyUrl ? isStarted ? <ChevronRightIcon size={chevronSize} /> :
        <Button
          style={startButtonStyle} isRound={true} type="navigation" onClick={showModal}>
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
  marginTop: 35,
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


interface StartStrategyModalProps extends Omit<ModalConfig, 'children'> {
  goals: readonly StrategyGoal[]
  hasStartedOtherStrategy: boolean
  onSubmit: () => void
}


const StartStrategyModal: React.FC<StartStrategyModalProps> = (props: StartStrategyModalProps) => {
  const {goals, hasStartedOtherStrategy, isShown, onSubmit, ...modalProps} = props

  const {email: userEmail, gender, name} = useSelector(
    ({user: {profile = {}}}: RootState): bayes.bob.UserProfile => profile,
    (profileA: bayes.bob.UserProfile, profileB: bayes.bob.UserProfile): boolean =>
      profileA.name === profileB.name && profileA.gender === profileB.gender &&
      profileA.email === profileB.email,
  )
  const isWorking = useSelector(({asyncState: {isFetching}}: RootState): boolean =>
    !!isFetching['EMAIL_CHECK'] || !!isFetching['AUTHENTICATE_USER'])

  const [isEmailRequired] = useState(!userEmail)
  const [isEmailInvalid, setEmailInvalid] = useState(false)
  const [isEmailAlreadyUsed, setEmailAlreadyUsed] = useState(false)
  const [email, setEmail] = useState('')

  const {t} = useTranslation()
  const inputRef = useRef<Input>(null)
  const dispatch = useDispatch<DispatchAllActions>()
  const submit = useCallback((): void => {
    if (userEmail) {
      onSubmit()
      return
    }
    if (!validateEmail(email)) {
      setEmailInvalid(true)
      inputRef.current && inputRef.current.focus()
      return
    }
    dispatch(emailCheck(email)).then((response): void => {
      if (!response) {
        return
      }
      if (!response.isNewUser) {
        setEmailAlreadyUsed(true)
        return
      }
      dispatch(silentlySetupCoaching(email)).then((response): void => {
        if (response) {
          onSubmit()
        }
      })
    })
  }, [dispatch, onSubmit, email, userEmail])
  const fastForward = useCallback((): void => {
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
    <FastForward onForward={fastForward} />
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
  const {isAnimationEnabled, makeStrategyLink, project, strategies, strategyStyle, title,
    titleStyle} = props
  const {t: translate} = useTranslation()
  const combinedStrategyStyle = useMemo(() => ({
    alignSelf: 'stretch',
    margin: '0 0 20px',
    ...strategyStyle,
  }), [strategyStyle])
  const hasStartedOneStrategy = useMemo(
    () => (strategies || []).filter(isValidStrategy).some((strategy): boolean =>
      getStrategyCompletion(project, strategy.strategyId).isStarted),
    [project, strategies],
  )
  if (!strategies || !strategies.length) {
    return null
  }
  return <div style={strategiesStyle}>
    <h2 style={titleStyle}>{translate(title, {count: strategies.length})}</h2>
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
  makeStrategyLink: PropTypes.func,
  project: PropTypes.object.isRequired,
  strategies: PropTypes.arrayOf(PropTypes.shape({
    strategyId: PropTypes.string,
  })),
  strategyStyle: PropTypes.object,
  title: PropTypes.string.isRequired,
  titleStyle: PropTypes.object,
}
const StrategiesList = React.memo(StrategiesListBase)

type StrategyClass = 'complete' | 'started' | 'main' | 'other'
type StrategyClasses = {[className in StrategyClass]: readonly bayes.bob.Strategy[]}

const StrategiesBase: React.FC<StrategiesProps> = (props: StrategiesProps): React.ReactElement => {
  const {project, strategies, titleStyle} = props
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
      title={prepareT('Autre stratégie', {count: 0})} />
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
  isFirstTime?: boolean
  onSubmit: (reachedGoals: {[key: string]: boolean}) => void
  readonly reachedGoals?: {[key: string]: boolean}
  shouldSubmitOnChange?: boolean
  style?: React.CSSProperties
}


interface GoalsSelectionEditorState {
  reachedGoals: {[key: string]: boolean}
  selectedGoals: readonly string[]
}


class GoalsSelectionEditorBase extends React.PureComponent<
GoalsSelectionEditorProps & WithTranslation, GoalsSelectionEditorState
> {
  public static propTypes = {
    goals: PropTypes.array.isRequired,
    isFirstTime: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    reachedGoals: PropTypes.objectOf(PropTypes.bool),
    shouldSubmitOnChange: PropTypes.bool,
    style: PropTypes.object,
  }

  private static itemStyle = (index: number): React.CSSProperties => isMobileVersion ? {
    borderTop: index ? `1px solid ${colors.MODAL_PROJECT_GREY}` : 'none',
    margin: '0 -20px 0 0',
    padding: '25px 30px 25px 0',
  } : {
    marginBottom: 10,
  }

  public state: GoalsSelectionEditorState = {
    reachedGoals: {},
    selectedGoals: [],
  }

  public static getDerivedStateFromProps(
    {reachedGoals = {}}: GoalsSelectionEditorProps,
    {reachedGoals: previousReachedGoals}: GoalsSelectionEditorState):
    GoalsSelectionEditorState|Pick<GoalsSelectionEditorState, 'reachedGoals'>|null {
    if (reachedGoals !== previousReachedGoals) {
      const goalChanged = (goalId: string): boolean =>
        !previousReachedGoals[goalId] !== !reachedGoals[goalId]
      if (Object.keys(previousReachedGoals).some(goalChanged) ||
        Object.keys(reachedGoals).some(goalChanged)) {
        return {
          reachedGoals,
          selectedGoals: Object.keys(reachedGoals).
            filter((goalId): boolean => reachedGoals[goalId]),
        }
      }
      return {reachedGoals}
    }
    return null
  }

  private handleGoalsChange = (selectedGoals: readonly string[]): void =>
    this.setState({selectedGoals}, (): void => {
      this.props.shouldSubmitOnChange && this.handleSubmit()
    })

  private handleSubmit = (): void => {
    const {goals, onSubmit} = this.props
    const selectedGoalsSet = new Set(this.state.selectedGoals)
    const reachedGoals =
      _fromPairs(goals.map(({goalId}): [string, boolean] => [goalId, selectedGoalsSet.has(goalId)]))
    onSubmit(reachedGoals)
  }

  private onForward = (): void => {
    const {goals, isFirstTime, shouldSubmitOnChange} = this.props
    if (!isFirstTime || this.state.selectedGoals.length) {
      this.handleSubmit()
      return
    }
    const selectedGoals = goals.
      filter((): boolean => Math.random() > .5).
      map(({goalId}): string => goalId)
    this.setState({selectedGoals})
    if (shouldSubmitOnChange) {
      this.handleSubmit()
    }
  }

  public render(): React.ReactNode {
    const {goals, isFirstTime, shouldSubmitOnChange, style, t} = this.props
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
    const buttonStyle: React.CSSProperties = {
      display: 'block',
      margin: '55px auto 0',
    }
    return <div style={containerStyle}>
      <FastForward onForward={this.onForward} />
      <CheckboxList
        onChange={this.handleGoalsChange} options={options} values={this.state.selectedGoals}
        checkboxStyle={GoalsSelectionEditorBase.itemStyle}
        selectedCheckboxStyle={selectedItemStyle} />
      {shouldSubmitOnChange ? null :
        <Button onClick={this.handleSubmit} style={buttonStyle} isRound={true} type="validation">
          {isFirstTime ? t('Valider') : t('Enregistrer')}
        </Button>}
    </div>
  }
}
const GoalsSelectionEditor = withTranslation()(GoalsSelectionEditorBase)


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
}


interface GoalsSelectionTabProps extends bayes.bob.WorkingStrategy, GoalsSelectionEditorProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
}


const GoalsSelectionTabBase = (props: GoalsSelectionTabProps): React.ReactElement => {
  const {coachingEmailFrequency, goals, lastModifiedAt, reachedGoals = {}, startedAt, onSubmit,
    ...otherProps} = props
  const [isModalShown, showModal, hideModal] = useModal()
  const {t} = useTranslation()

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
      <div style={coachingStyle} onClick={showModal}>
        <div style={{flex: 1}}>{t('Type de coaching')}</div>
        <div style={{fontStyle: 'italic', fontWeight: 'bold', margin: 10}}>{
          // i18next-extract-disable-next-line
          t(coaching) ||
            t('Désactivé')
        }</div>
        <ChevronRightIcon size={20} color={colors.COOL_GREY} />
      </div>
    </section>
    <section>
      <header style={mobileSectionHeaderStyle}>Mes objectifs</header>
      <GoalsSelectionEditor
        {...otherProps} shouldSubmitOnChange={true} isFirstTime={!startedAt}
        {...{goals, onSubmit, reachedGoals}} />
      {/* TODO(pascal): Translate those dates. */}
      {startedAt ? <div style={calendarStyle}>
        Commencé le {getDateString(startedAt)}<br />
        {lastModifiedAt ?
          `Dernière
            modification ${getDiffBetweenDatesInString(new Date(lastModifiedAt), new Date())}` :
          null}
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


interface StrategyPageConnectedProps {
  goals: readonly StrategyGoal[]
  methods: readonly [ValidAdvice, string][]
  openedStrategy: bayes.bob.WorkingStrategy & {strategyId: string}
  profile: bayes.bob.UserProfile
  testimonials: readonly StrategyTestimonial[]
}


export interface StrategyPageParams {
  adviceId?: string
  strategyId?: string
}


interface StrategyPageConfig extends RouteComponentProps<StrategyPageParams>, WithTranslation {
  project: bayes.bob.Project
  projectUrl: string
  strategy: bayes.bob.Strategy & {strategyId: string}
  strategyRank: number
  strategyUrl: string
}


interface StrategyPageProps
  extends StrategyPageConnectedProps, StrategyPageConfig, WithTranslation {
  dispatch: DispatchAllActions
}


class StrategyPageBase extends React.PureComponent<StrategyPageProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    // TODO(pascal): Fix this after getting out of the workbench.
    match: ReactRouterPropTypes.match.isRequired,
    openedStrategy: PropTypes.shape({
      reachedGoals: PropTypes.objectOf(PropTypes.bool),
      startedAt: PropTypes.string,
    }).isRequired,
    profile: PropTypes.shape({
      coachingEmailFrequency: PropTypes.string,
      email: PropTypes.string,
      gender: PropTypes.string,
    }),
    project: PropTypes.shape({
      advices: PropTypes.array.isRequired,
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
    t: PropTypes.func.isRequired,
  }

  public componentDidMount(): void {
    const {dispatch, openedStrategy: {startedAt}, project, strategy, strategyRank} = this.props
    if (startedAt) {
      dispatch(strategyWorkPageIsShown(project, strategy, strategyRank))
    }
  }

  private handleGoalsSelection = (reachedGoals: {[goalId: string]: boolean}): void => {
    const {dispatch, project, openedStrategy, strategy: {strategyId}, strategyRank} = this.props
    const workingStrategy = {
      ...openedStrategy,
      reachedGoals,
      strategyId,
    }
    if (!openedStrategy.startedAt) {
      dispatch(startStrategy(project, workingStrategy, strategyRank))
    }
    if (!_isEqual(openedStrategy, workingStrategy)) {
      dispatch(replaceStrategy(project, workingStrategy))
    }
  }

  private renderNavBarContent(): JSX.Element {
    const {t} = this.props
    if (isMobileVersion) {
      return <span style={{fontSize: 13}}>{this.props.strategy.title}</span>
    }
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      bottom: 0,
      display: 'flex',
      left: 30,
      margin: 'auto 0',
      position: 'absolute',
      top: 0,
    }
    const linkStyle: React.CSSProperties = {
      alignItems: 'center',
      color: 'inherit',
      display: 'flex',
      fontWeight: 'bold',
      textDecoration: 'none',
    }
    return <div style={containerStyle}>
      <Link to={this.props.projectUrl} style={linkStyle}>
        <ArrowLeftIcon size={24} style={{marginRight: 25}} />{t('Diagnostic')}
      </Link>
    </div>
  }

  private renderDesktop(startedAt: string): React.ReactNode {
    const {
      methods,
      openedStrategy,
      project,
      projectUrl,
      strategy, strategy: {isPrincipal, strategyId, title},
      t,
    } = this.props
    const titleStyle = {
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
    return <PageWithNavigationBar
      page="strategie" navBarContent={this.renderNavBarContent()} isLogoShown={false}
      onBackClick={projectUrl} style={{backgroundColor: '#fff'}}>
      <header
        style={{margin: '0 auto 35px', maxWidth: 1000, padding: '0 20px'}}>
        <h1 style={titleStyle}>{title}</h1>
        <div style={{alignItems: 'center', display: 'flex'}}>
          <WhyButton strategy={strategy} />
          {/* TODO(pascal): Translate the dates in English. */}
          <div style={dateStyle}>Commencé le {getDateString(startedAt)}</div>
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
          onChange={this.handleGoalsSelection} openedStrategy={openedStrategy}
          isPrincipal={!!isPrincipal} />
      </div>
      {/* TODO(pascal): Cleanup testimonials. */}
    </PageWithNavigationBar>
  }

  private renderGoalsTab = (): React.ReactNode => {
    const {
      goals,
      openedStrategy,
      profile: {coachingEmailFrequency},
    } = this.props
    return <GoalsSelectionTab
      goals={goals} {...openedStrategy}
      coachingEmailFrequency={coachingEmailFrequency} onSubmit={this.handleGoalsSelection} />
  }

  private renderMethodsList =
  (methods: readonly [ValidAdvice, string|undefined][], isRead?: boolean): React.ReactNode => {
    const {t} = this.props
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
            to={`${this.props.strategyUrl}/${adviceId}`} key={adviceId}
            style={adviceStyle(index)}>
            <AdvicePicto adviceId={adviceId} style={{marginRight: 15}} />
            <div style={{flex: 1}}>{teaser}</div>
            <ChevronRightIcon
              style={{flex: 'none', marginLeft: 10}} size={20} color={colors.COOL_GREY} />
          </Link>)}
      </div>
    </section>
  }

  private renderMethodsTab = (): React.ReactNode => {
    const {methods} = this.props
    const {false: unreadMethods = [], true: readMethods = []} =
      _groupBy(methods, ([{status}]): boolean => status === 'ADVICE_READ')
    return <React.Fragment>
      {this.renderMethodsList(unreadMethods)}
      {this.renderMethodsList(readMethods, true)}
    </React.Fragment>
  }

  public renderStartedMobile(): React.ReactNode {
    const {match: {params: {adviceId: shownTab}}, projectUrl, strategy: {title},
      strategyUrl, t} = this.props
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
          <Route path={`${strategyUrl}/objectifs`} render={this.renderGoalsTab} />
          <Route path={`${strategyUrl}/methodes`} render={this.renderMethodsTab} />
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

  public render(): React.ReactNode {
    const {match: {params: {adviceId}}, openedStrategy: {startedAt = undefined} = {},
      projectUrl, strategyUrl} = this.props
    if (!startedAt) {
      return <Redirect to={projectUrl} />
    }
    if (isMobileVersion) {
      return this.renderStartedMobile()
    }
    if (adviceId) {
      return <Redirect to={strategyUrl} />
    }
    return this.renderDesktop(startedAt)
  }
}
type ValidStrategyAdvice = bayes.bob.StrategyAdvice & {adviceId: string}
const StrategyPage = withTranslation()(connect(
  (
    {user: {profile = {}}}: RootState,
    {
      project, project: {advices = []} = {},
      strategy: {piecesOfAdvice = [], strategyId},
      t,
    }: StrategyPageConfig,
  ): StrategyPageConnectedProps => {
    const validAdvices =
      advices.filter((a: bayes.bob.Advice): a is ValidAdvice => a && !!a.adviceId)
    const advicesById = _keyBy(validAdvices, 'adviceId')
    const methods = piecesOfAdvice.
      filter((a): a is ValidStrategyAdvice => !!(a.adviceId && advicesById[a.adviceId])).
      map(({adviceId, teaser}): [ValidAdvice, string] => [
        advicesById[adviceId],
        upperFirstLetter(teaser || getAdviceGoal(advicesById[adviceId], t)),
      ])
    const goals = getStrategyGoals(strategyId, t)
    const testimonials = getStrategiesTestimonials(t)[strategyId] || []
    return {
      goals,
      methods,
      openedStrategy: getStartedStrategy(project, strategyId),
      profile,
      testimonials,
    }
  })(StrategyPageBase))


export {Strategies, StrategyPage, ObservationMethod}
