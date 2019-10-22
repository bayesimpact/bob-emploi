import _fromPairs from 'lodash/fromPairs'
import _groupBy from 'lodash/groupBy'
import _isEqual from 'lodash/isEqual'
import _keyBy from 'lodash/keyBy'
import _memoize from 'lodash/memoize'
import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CheckIcon from 'mdi-react/CheckIcon'
import StarIcon from 'mdi-react/StarIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {connect} from 'react-redux'
import {Route, RouteComponentProps, Switch} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'
import {Swipeable} from 'react-swipeable'

import {DispatchAllActions, RootState, displayToasterMessage, setUserProfile, startStrategy,
  replaceStrategy, strategyWorkPageIsShown, strategyExplorationPageIsShown} from 'store/actions'
import {ValidAdvice, getAdviceGoal} from 'store/advice'
import {StrategyGoal, StrategyTestimonial, YouChooser, genderize, getDateString,
  getDiffBetweenDatesInString, getStrategyGoals, getStrategiesTestimonials,
  upperFirstLetter} from 'store/french'
import {impactFromPercentDelta} from 'store/score'
import {StrategyCompletion, getStartedStrategy, getStrategyCompletion,
  getStrategyProgress, isValidStrategy} from 'store/strategy'
import {youForUser} from 'store/user'

import {AdvicePicto, WorkingMethod} from 'components/advisor'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {SignUpBanner} from 'components/pages/signup'
import {CheckboxList} from 'components/pages/connected/form_utils'
import {CoachingConfirmationModal} from 'components/pages/connected/coaching_modal'
import {SmartLink} from 'components/radium'
import {AppearingList, BobScoreCircle, Button, FastTransitions, GrowingNumber, LabeledToggle,
  Markdown, PercentBar, PieChart, SmoothTransitions, Tag, UpDownIcon,
  colorToAlpha} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'
import goalsIcon from 'images/goals-icon.svg'
import selectedGoalsIcon from 'images/goals-icon-selected.svg'
import manImage from 'images/man-icon.svg'
import methodsIcon from 'images/methods-icon.svg'
import selectedMethodsIcon from 'images/methods-icon-selected.svg'
import womanImage from 'images/woman-icon.svg'

import {BobModal} from './speech'

// TODO(cyrille): Move to store.
interface FollowupOption {
  description: (userYou: YouChooser, genderE?: string) => string
  name: string
  value: bayes.bob.EmailFrequency
}

const FOLLOWUP_EMAILS_OPTIONS: Readonly<FollowupOption[]> = [
  {
    description: (userYou): string =>
      `Un email pour ${userYou('te', 'vous')} booster une fois par mois`,
    name: 'Occasionel',
    value: 'EMAIL_ONCE_A_MONTH',
  },
  {
    description: (userYou): string =>
      // TODO(cyrille): Make description more explicit about being the maximum frequency.
      `Un email par semaine pour que rien ne ${userYou("t'", 'vous ')}échappe`,
    name: 'Régulier',
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
  isDisabled: boolean
  isSelected: boolean
  name: string
  onClick: () => void
  style: RadiumCSSProperties
}

class CoachingOptionBase extends React.PureComponent<CoachingOptionProps> {
  public render(): React.ReactNode {
    const {description, isDisabled, isSelected, name, onClick, style} = this.props
    const selectedStyle = {
      backgroundColor: colorToAlpha(colors.BOB_BLUE, .09),
      border: `2px solid ${colors.BOB_BLUE}`,
    }
    const optionStyle = {
      ...isDisabled ? {
        border: `2px solid ${colors.MODAL_PROJECT_GREY}`,
        color: colors.COOL_GREY,
      } : {
        ':hover': selectedStyle,
        border: `2px solid ${colorToAlpha(colors.BOB_BLUE, 0)}`,
        boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
      },
      alignItems: 'center',
      borderRadius: 10,
      display: 'flex',
      padding: '20px 25px',
      ...isSelected && selectedStyle,
      ...FastTransitions,
      ...style,
    }
    const descriptionStyle = {
      color: colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      lineHeight: '19px',
    }
    return <div onClick={isDisabled ? undefined : onClick} style={optionStyle}>
      <LabeledToggle
        style={{marginBottom: 0}} isDisabled={isDisabled}
        label={<div style={{marginLeft: 10}}>
          <h3 style={{fontSize: 18, margin: 0}}>{name}</h3>
          <div style={descriptionStyle}>{description}</div>
        </div>}
        isSelected={isSelected} type="radio" />
    </div>
  }
}
const CoachingOption = Radium(CoachingOptionBase)


interface CoachingModalConnectedProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  gender?: bayes.bob.Gender
  isRegistrationNeeded: boolean
  userYou: YouChooser
}

interface CoachingModalProps extends Omit<ModalConfig, 'children'>, CoachingModalConnectedProps {
  dispatch: DispatchAllActions
}

interface CoachingModalState {
  frequency?: bayes.bob.EmailFrequency
  isActive?: boolean
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
        isActive: true,
      },
      isShown,
    }
  }

  private handleToggleActive = (): void => this.setState(({isActive}): CoachingModalState => ({
    frequency: isActive ? 'EMAIL_NONE' : undefined,
    isActive: !isActive,
  }))

  private handleClickOption = _memoize((frequency): (() => void) => (): void =>
    this.setState({frequency}))

  private handleCloseRegistrationModal = (): void => {
    const {dispatch} = this.props
    dispatch(setUserProfile(
      {coachingEmailFrequency: undefined}, true, 'FINISH_PROFILE_SETTINGS')).
      then((): void => {
        dispatch(displayToasterMessage('Le coaching a été annulé'))
      })
  }

  private handleConfirm = (): void => {
    const {dispatch, onClose} = this.props
    const {frequency: coachingEmailFrequency} = this.state
    // TODO(cyrille): Change action to something specific remembering the strategy.
    dispatch(setUserProfile({coachingEmailFrequency}, true, 'FINISH_PROFILE_SETTINGS')).
      then((success): void => {
        if (success) {
          onClose && onClose()
          dispatch(displayToasterMessage('Modifications sauvegardées.'))
        }
      })
  }

  public render(): React.ReactNode {
    const {coachingEmailFrequency, gender, isRegistrationNeeded, isShown, onClose,
      userYou} = this.props
    const {frequency, isActive} = this.state
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
        userYou={userYou} onCloseModal={this.handleCloseRegistrationModal} /> : null}
      <Modal
        isShown={isShown} onClose={onClose} style={{margin: 20}}
        title={`Choisis${userYou('', 'sez')} le coaching qui ${userYou('te', 'vous')} convient`}>
        <div style={contentStyle}>
          <LabeledToggle
            onClick={this.handleToggleActive} type="swipe" style={{marginBottom: 20}}
            label={`Coaching ${isActive ? '' : 'des'}activé`} isSelected={isActive} />
          {FOLLOWUP_EMAILS_OPTIONS.map(({description, value, ...option}): React.ReactNode =>
            <CoachingOption
              {...option} isSelected={frequency === value} isDisabled={!isActive}
              description={description(userYou, genderize('·e', 'e', '', gender))}
              onClick={this.handleClickOption(value)}
              key={value} style={{marginBottom: 20}} />)}
          <div style={buttonsStyle}>
            <Button isRound={true} type="back" style={{marginRight: 15}} onClick={onClose}>
              Annuler
            </Button>
            <Button isRound={true} disabled={!frequency} onClick={this.handleConfirm}>
              Continuer
            </Button>
          </div>
        </div>
      </Modal>
    </React.Fragment>
  }
}
const CoachingModal = connect(
  ({user, user: {hasAccount, profile: {coachingEmailFrequency, email, gender} = {}}}: RootState):
  CoachingModalConnectedProps => ({
    coachingEmailFrequency,
    gender,
    isRegistrationNeeded: !hasAccount && !email,
    userYou: youForUser(user),
  }))(CoachingModalBase)


interface SelectedCoachingConnectedProps {
  frequency?: bayes.bob.EmailFrequency
}

interface SelectCoachingProps extends SelectedCoachingConnectedProps {
  onClick?: () => void
  style?: RadiumCSSProperties
}

class SelectCoachingBase extends React.PureComponent<SelectCoachingProps> {
  public render(): React.ReactNode {
    const {frequency, style, onClick} = this.props
    if (!frequency || frequency === 'EMAIL_NONE' || frequency === 'UNKNOWN_EMAIL_FREQUENCY') {
      return <Button
        onClick={onClick}
        isRound={true} style={{display: 'block', ...style}}>
        Activer le coaching de {config.productName}
      </Button>
    }
    const containerStyle = {
      ...strategyCardStyle,
      ':hover': {
        border: `2px solid ${colors.COOL_GREY}`,
      },
      alignItems: 'center',
      ...!!onClick && {cursor: 'pointer'},
      display: 'flex',
      padding: '20px 25px',
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
    return <div onClick={onClick} style={containerStyle}>
      <div style={{flex: 1}}>
        <div style={headerStyle}>Type de coaching&nbsp;:</div>
        <div style={nameStyle}>{name}</div>
      </div>
      <ChevronDownIcon size={24} />
    </div>
  }
}
const SelectCoaching = connect(({user: {
  profile: {coachingEmailFrequency: frequency} = {},
}}: RootState):
SelectedCoachingConnectedProps => ({frequency}))(Radium(SelectCoachingBase))


interface GoalsPanelProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  handleEngagement: () => void
  openedStrategy: bayes.bob.WorkingStrategy & {strategyId: string}
  style?: React.CSSProperties
  userYou: YouChooser
}

interface GoalsPanelState {
  isCoachingModalShown: boolean
  isExpanded: boolean
}

class GoalsPanel extends React.PureComponent<GoalsPanelProps, GoalsPanelState> {

  public state = {
    isCoachingModalShown: false,
    isExpanded: false,
  }

  private toggleExpand = (): void =>
    this.setState(({isExpanded}): {isExpanded: boolean} => ({isExpanded: !isExpanded}))

  private handleShowCoachingModal = _memoize((isCoachingModalShown): (() => void) => (): void =>
    this.setState({isCoachingModalShown}))

  public render(): React.ReactNode {
    const {handleEngagement,
      openedStrategy: {lastModifiedAt, reachedGoals = {}, strategyId}, style, userYou} = this.props
    const {isCoachingModalShown, isExpanded} = this.state
    const goalsStyle = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      fontSize: 13,
      padding: '15px 0',
    }
    const modifyGoalsStyle: React.CSSProperties = {
      backgroundColor: colors.BOB_BLUE,
      borderRadius: 10,
      color: '#fff',
      cursor: 'pointer',
      fontSize: 13,
      fontStyle: 'italic',
      margin: '0 auto',
      maxWidth: 75,
      padding: '2px 10px',
      textAlign: 'center',
    }
    const lastModifiedStyle: React.CSSProperties = {
      fontSize: 11,
      fontStyle: 'italic',
      margin: '10px auto 0',
      textAlign: 'center',
    }
    const goals = getStrategyGoals(userYou, strategyId)
    const progress = Math.round(getStrategyProgress(goals, reachedGoals))
    const expandableSectionStyle = {
      ...isExpanded ? {} : {maxHeight: 0, overflow: 'hidden'},
      ...SmoothTransitions,
    }
    const expandButtonStyle: React.CSSProperties = {
      alignItems: 'center',
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      justifyContent: 'center',
      paddingTop: 15,
    }
    return <StratPanel style={style} title={`${userYou('Tes', 'Vos')} objectifs`}>
      <CoachingModal isShown={isCoachingModalShown} onClose={this.handleShowCoachingModal(false)} />
      <div style={strategyCardStyle}>
        <PieChart
          radius={40} strokeWidth={6} backgroundColor={colors.MODAL_PROJECT_GREY}
          percentage={progress} style={{color: colors.GREENISH_TEAL, margin: '10px auto 20px'}}>
          <span style={{color: colors.DARK_TWO, fontSize: 20}}>
            <GrowingNumber isSteady={true} number={progress} />%
          </span>
        </PieChart>
        <div style={expandableSectionStyle}>
          <div style={goalsStyle}>
            <StrategyGoalsList
              goals={goals} reachedGoals={reachedGoals} style={{marginLeft: -10}} />
          </div>
          <div style={{borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`, padding: '15px 0'}}>
            <div style={modifyGoalsStyle} onClick={handleEngagement}>Modifier</div>
            {lastModifiedAt ? <div style={lastModifiedStyle}>
              Dernière
              modification {getDiffBetweenDatesInString(new Date(lastModifiedAt), new Date())}
            </div> : null}
          </div>
        </div>
        <div onClick={this.toggleExpand} style={expandButtonStyle}>
          Voir {isExpanded ? 'moins' : 'plus'}
          <UpDownIcon style={{flex: 'none'}} size={16} icon="chevron" isUp={isExpanded} />
        </div>
      </div>
      <SelectCoaching
        style={{margin: '30px auto 0'}} onClick={this.handleShowCoachingModal(true)} />
    </StratPanel>
  }
}


const METHODS_PER_ROW = 2

const makeStartStrategyOptions = (eFeminine = ''):
Readonly<{name: string; value: string}[]> => [
  {
    name: `Je suis d'accord pour m'investir dans cette stratégie avec l'aide de
      ${config.productName}`,
    value: 'commit',
  },
  {
    name: `Je suis prêt${eFeminine} à m'engager sur cette stratégie pendant au moins quelques
      jours`,
    value: 'commit-time',
  },
] as const
const startStrategyOptionsCount = makeStartStrategyOptions().length

interface WhyButtonProps {
  onClick?: (event: React.MouseEvent) => void
  strategy: bayes.bob.Strategy
  style?: React.CSSProperties
}

class WhyButtonBase extends React.PureComponent<WhyButtonProps, {isModalShown?: boolean}> {
  public static propTypes = {
    onClick: PropTypes.func,
    strategy: PropTypes.shape({
      header: PropTypes.string,
    }).isRequired,
    style: PropTypes.object,
  }

  public state = {
    isModalShown: false,
  }

  private handleCloseModal = (): void => this.setState({isModalShown: false})

  private onClick = (event): void => {
    const {onClick} = this.props
    onClick && onClick(event)
    this.setState({isModalShown: true})
  }

  public render(): React.ReactNode {
    const {strategy: {header: why}, style} = this.props
    if (!why) {
      return null
    }
    const buttonStyle: RadiumCSSProperties = {
      ':hover': {
        boxShadow: 'rgba(0, 0, 0, 0.2) 0px 4px 10px 0px',
        color: 'inherit',
      },
      alignItems: 'center',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      borderRadius: 20,
      color: colors.WARM_GREY,
      cursor: 'pointer',
      display: 'inline-flex',
      fontSize: 11,
      fontStyle: 'italic',
      fontWeight: 'bold',
      padding: '5px 12px 5px 5px',
      ...style,
    }
    const bobStyle = {
      display: 'block',
      marginRight: 9,
      width: 15,
    }
    return <React.Fragment>
      <BobModal
        onConfirm={this.handleCloseModal} isShown={this.state.isModalShown} buttonText="OK">
        {why}
      </BobModal>
      <div style={buttonStyle} onClick={this.onClick}>
        <img src={bobHeadImage} alt={config.productName} style={bobStyle} />
        L'explication de {config.productName}
      </div>
    </React.Fragment>
  }
}
const WhyButton = Radium(WhyButtonBase)


interface ListItemProps {
  chevronSize?: number
  strategy: bayes.bob.Strategy
  strategyCompletion: StrategyCompletion
  strategyUrl: string
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
  const {chevronSize, strategy: {isPrincipal, description, score, title},
    strategyCompletion: {isComplete, isStarted, progress}, strategyUrl, style} = props
  const isCurrent = isStarted && !isComplete
  const containerStyle = useMemo(
    (): React.CSSProperties => getContainerStyle(style, isStarted), [style, isStarted])
  const progressBarStyle = useMemo(
    (): React.CSSProperties => getProgressBarStyle(progress), [progress])
  const {color} = impactFromPercentDelta(score || 0)
  return <SmartLink to={isStarted ? strategyUrl : undefined} style={containerStyle}>
    <div style={contentStyle}>
      <div>
        <div style={titleStyle}>{title}</div>
        <div>Impact&nbsp;: <span style={getImpactStyle(color)}>+&nbsp;{score}%</span></div>
      </div>
      {isPrincipal ? <Tag style={tagStyle}>Priorité</Tag> : null}
      <div style={flexFillerStyle} />
      {isComplete ? <CheckIcon style={completedStyle} size={30} /> : null}
      {isStarted ? <ChevronRightIcon size={chevronSize} /> :
        <Link to={strategyUrl}><Button style={startButtonStyle} isRound={true} type="navigation">
          Commencer
        </Button></Link>}
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
  strategy: PropTypes.shape({
    description: PropTypes.string,
    isPrincipal: PropTypes.bool,
    score: PropTypes.number,
    title: PropTypes.string.isRequired,
  }).isRequired,
  strategyCompletion: PropTypes.object.isRequired,
  strategyUrl: PropTypes.string.isRequired,
  style: PropTypes.object,
}
StrategyListItemBase.defaultProps = {
  chevronSize: 24,
}
const StrategyListItem = React.memo(StrategyListItemBase)


interface StrategiesProps {
  makeStrategyLink: (strategyId: string) => string
  project: bayes.bob.Project
  strategies?: readonly bayes.bob.Strategy[]
  strategyStyle?: React.CSSProperties
  titleStyle?: React.CSSProperties
}

const openedStrategiesTitle = (isPlural: boolean): React.ReactElement =>
  <span style={{color: colors.BOB_BLUE}}>Stratégie{isPlural ? 's' : ''} en cours</span>

const possibleStrategiesTitle = (isPlural: boolean): string =>
  `Stratégie${isPlural ? 's' : ''} possible${isPlural ? 's' : ''}`

const completedStrategiesTitle = (isPlural: boolean): string =>
  `Stratégie${isPlural ? 's' : ''} terminée${isPlural ? 's' : ''}`

interface StrategiesListProps extends StrategiesProps {
  canShowAll?: boolean
  title: (isPlural: boolean) => React.ReactNode
}

const strategiesStyle = {
  marginBottom: 40,
}

const seeMoreStyle: RadiumCSSProperties = {
  ':hover': {
    textDecoration: 'underline',
  },
  display: 'inline-block',
}

const StrategiesListBase: React.FC<StrategiesListProps> = (props): React.ReactElement|null => {
  const {canShowAll, makeStrategyLink, project, strategies, strategyStyle,
    title, titleStyle} = props
  const [areAllStrategiesShown, setAllStrategiesShown] = useState(canShowAll)
  useEffect((): void => {
    if (canShowAll && !areAllStrategiesShown) {
      setAllStrategiesShown(true)
    }
  }, [areAllStrategiesShown, canShowAll])
  const maxNumChildren = areAllStrategiesShown || !strategies ? 0 :
    strategies.findIndex(({isSecondary}) => isSecondary)
  useEffect((): void => {
    // Do not show the "More strategies" link if there are no more left hidden.
    if (!areAllStrategiesShown && maxNumChildren === -1) {
      setAllStrategiesShown(true)
    }
  }, [areAllStrategiesShown, maxNumChildren])
  const showAllStrategies = useCallback(() => setAllStrategiesShown(true), [])
  const combinedStrategyStyle = useMemo(() => ({
    alignSelf: 'stretch',
    margin: '0 0 20px',
    ...strategyStyle,
  }), [strategyStyle])
  if (!strategies || !strategies.length) {
    return null
  }
  return <div style={strategiesStyle}>
    <h2 style={titleStyle}>{title(strategies.length > 1)}</h2>
    {areAllStrategiesShown || maxNumChildren ? <AppearingList maxNumChildren={maxNumChildren}>
      {strategies.filter(isValidStrategy).
        map((strategy, index): ReactStylableElement => <StrategyListItem
          key={index} style={combinedStrategyStyle} strategy={strategy}
          strategyCompletion={getStrategyCompletion(project, strategy.strategyId)}
          strategyUrl={makeStrategyLink(strategy.strategyId)} />)}
    </AppearingList> : null}
    {areAllStrategiesShown ? null :
      <SmartLink style={seeMoreStyle} onClick={showAllStrategies}>
        + Afficher plus de stratégies
      </SmartLink>}
  </div>
}
StrategiesListBase.propTypes = {
  canShowAll: PropTypes.bool.isRequired,
  makeStrategyLink: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  strategies: PropTypes.arrayOf(PropTypes.shape({
    strategyId: PropTypes.string,
  })),
  strategyStyle: PropTypes.object,
  title: PropTypes.func.isRequired,
  titleStyle: PropTypes.object,
}
StrategiesListBase.defaultProps = {
  canShowAll: true,
}
const StrategiesList = React.memo(StrategiesListBase)

type StrategyClass = 'complete' | 'started' | 'other'
type StrategyClasses = {[className in StrategyClass]: readonly bayes.bob.Strategy[]}

const StrategiesBase: React.FC<StrategiesProps> = (props: StrategiesProps): React.ReactElement => {
  const {project, strategies} = props
  const classifiedStrategies = useMemo((): StrategyClasses =>
    _groupBy<bayes.bob.Strategy>(strategies, ({strategyId}): StrategyClass => {
      if (!strategyId) {
        return 'other'
      }
      const {isComplete, isStarted} = getStrategyCompletion(project, strategyId)
      return isComplete ? 'complete' : isStarted ? 'started' : 'other'
    // TODO(cyrille): See if @types/lodash.Dictionary can have an explicit key type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }) as unknown as StrategyClasses, [project.openedStrategies, strategies])
  return <React.Fragment>
    <StrategiesList
      {...props}
      strategies={classifiedStrategies['started']}
      title={openedStrategiesTitle} />
    <StrategiesList
      {...props}
      strategies={classifiedStrategies['other']}
      canShowAll={false}
      title={possibleStrategiesTitle} />
    <StrategiesList
      {...props}
      strategies={classifiedStrategies['complete']}
      title={completedStrategiesTitle} />
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


interface BulletsProps extends React.HTMLProps<HTMLDivElement> {
  selectedIndex: number
  total: number
}

class Bullets extends React.PureComponent<BulletsProps> {
  public render(): React.ReactNode {
    const {selectedIndex, style, total, ...otherProps} = this.props
    const bulletStyle = (distance: number): React.CSSProperties => ({
      backgroundColor: distance ? colors.MODAL_PROJECT_GREY : colors.BOB_BLUE,
      borderRadius: '50%',
      ...distance > 3 && {display: 'none'},
      height: distance <= 1 ? 8 : distance <= 2 ? 6 : 4,
      margin: '0 2px',
      width: distance <= 1 ? 8 : distance <= 2 ? 6 : 4,
      ...SmoothTransitions,
    })
    return <div style={{alignItems: 'center', display: 'flex', ...style}} {...otherProps}>
      {new Array(total).fill(undefined).map((unused, index): React.ReactNode =>
        <div key={index} style={bulletStyle(Math.abs(index - selectedIndex))} />)}
    </div>
  }
}
interface SwipeableListProps {
  children: ReactStylableElement[] | ReactStylableElement
  childrenByPage: number
}

// Currently assumes the carousel takes most of the window's width
class SwipeableList extends React.PureComponent<SwipeableListProps, {pageIndex: number}> {
  public static defaultProps = {
    childrenByPage: 1,
  }

  public state = {
    pageIndex: 0,
  }

  private pageCount = (): number =>
    Math.ceil(React.Children.count(this.props.children) / this.props.childrenByPage)

  private handlePageChange = _memoize((delta: number): (() => void) => (): void =>
    this.setState(({pageIndex}): {pageIndex: number} => {
      const pageCount = this.pageCount()
      return {pageIndex: (pageCount + pageIndex + delta) % pageCount}
    })
  )

  private renderInvisibleChildren(): readonly React.ReactNode[] | null {
    const {children, childrenByPage} = this.props
    const childrenCount = React.Children.count(children)
    if (!(childrenCount % childrenByPage)) {
      return null
    }
    const anyChild = React.Children.toArray(children)[0] as ReactStylableElement
    const invisibleCount = childrenByPage - (childrenCount % childrenByPage)
    return new Array(invisibleCount).fill(undefined).map((unused, index): React.ReactNode =>
      React.cloneElement(anyChild, {
        key: `invisible-${index}`,
        style: {...anyChild.props.style, visibility: 'hidden'},
      }))
  }

  private renderPage(pageIndex, {style, ...otherProps}: Swipeable['props'] = {}): React.ReactNode {
    const pageCount = this.pageCount()
    if (pageIndex < 0 || pageIndex >= pageCount) {
      return null
    }
    const {children, childrenByPage} = this.props
    const childStyle = {
      display: 'flex',
      ...SmoothTransitions,
      ...style,
    }
    return <Swipeable key={pageIndex} style={childStyle} {...otherProps}>
      {React.Children.map(children, (child, index): React.ReactNode =>
        Math.floor(index / childrenByPage) === pageIndex ? child : null)}
      {pageIndex === pageCount - 1 ? this.renderInvisibleChildren() : null}
    </Swipeable>
  }

  public render(): React.ReactNode {
    const {pageIndex} = this.state
    const pageCount = this.pageCount()
    if (pageCount <= 1) {
      return this.renderPage(0)
    }
    const sideStyle: React.CSSProperties = {left: 0, opacity: 0, position: 'absolute', top: 0}
    const summaryStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      marginTop: 15,
      minHeight: '1em',
      position: 'relative',
    }
    return <div style={{overflow: 'hidden', position: 'relative'}}>
      { // TODO(cyrille): Find a way to translate only of parent width.
        this.renderPage(pageIndex - 1, {style: {...sideStyle, transform: 'translateX(-100vw)'}})}
      {this.renderPage(pageIndex, {
        ...pageIndex > 0 && {onSwipedRight: this.handlePageChange(-1)},
        ...pageIndex < pageCount - 1 && {onSwipedLeft: this.handlePageChange(1)},
      })}
      {this.renderPage(pageIndex + 1, {style: {...sideStyle, transform: 'translateX(100vw)'}})}
      <div style={summaryStyle}>
        <Bullets selectedIndex={pageIndex} total={pageCount} />
        <div style={{fontSize: 13, position: 'absolute', right: 0, top: 0}}>
          <span style={{fontWeight: 'bold'}}>{pageIndex + 1}</span>/{pageCount}
        </div>
      </div>
    </div>
  }
}

const LEFT_PANEL_WIDTH = 600

const RIGHT_PANEL_WIDTH = 295

class StrategySection extends React.PureComponent<Omit<StratPanelProps, 'ref'>> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {children, style, title, ...otherProps} = this.props
    const sectionStyle = {
      marginBottom: 60,
      maxWidth: LEFT_PANEL_WIDTH,
      ...style,
    }
    return <StratPanel style={sectionStyle} {...otherProps} title={title}>
      {children}
    </StratPanel>
  }
}


interface GoalsProps {
  goals: readonly StrategyGoal[]
  reachedGoals: {[goalId: string]: boolean}
  style?: React.CSSProperties
}


class StrategyGoalsList extends React.PureComponent<GoalsProps> {
  public static propTypes = {
    goals: PropTypes.arrayOf(PropTypes.shape({
      content: PropTypes.string.isRequired,
      goalId: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    reachedGoals: PropTypes.objectOf(PropTypes.bool).isRequired,
    style: PropTypes.object,
  }

  private renderGoal = ({content, goalId}, isReached): React.ReactNode => {
    const containerStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      fontSize: isMobileVersion ? 13 : 'inherit',
      marginTop: 15,
    }
    const checkCircleWidth = 20
    const bulletWidth = checkCircleWidth / 5
    const iconStyle: React.CSSProperties = {
      fill: colors.GREENISH_TEAL,
      flexShrink: 0,
    }
    const discStyle: React.CSSProperties = {
      color: colors.COOL_GREY,
      flexShrink: 0,
      // To get a bullet of 4px, we found that a font of 14px was working (in Lato).
      fontSize: 3.5 * bulletWidth,
      lineHeight: `${checkCircleWidth}px`,
      textAlign: 'center',
      width: checkCircleWidth,
    }
    return <div key={goalId} style={containerStyle}>
      {isReached ?
        <CheckCircleIcon size={checkCircleWidth} style={iconStyle} /> :
        <div style={discStyle}>&bull;</div>}
      <span style={{marginLeft: 15}}>
        <Markdown content={content} isSingleLine={true} />
      </span>
    </div>
  }

  public render(): React.ReactNode {
    const {goals, reachedGoals, style} = this.props
    return <div style={style}>
      {goals.map((goal): React.ReactNode => this.renderGoal(goal, reachedGoals[goal.goalId]))}
    </div>
  }
}


class GoalsSelectionTitle
  extends React.PureComponent<{isFirstTime?: boolean; userYou: YouChooser}> {
  public static propTypes = {
    isFirstTime: PropTypes.bool,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {isFirstTime, userYou} = this.props
    if (isFirstTime) {
      return `Qu'a${userYou('s-tu', 'vez-vous')} déjà fait\u00A0?`
    }
    return 'Valider mes objectifs atteints'
  }
}


interface GoalsSelectionEditorProps {
  goals: readonly StrategyGoal[]
  isFirstTime?: boolean
  onSubmit: (reachedGoals: {[key: string]: boolean}) => void
  readonly reachedGoals?: {[key: string]: boolean}
  shouldSubmitOnChange?: boolean
}


interface GoalsSelectionEditorState {
  reachedGoals: {[key: string]: boolean}
  selectedGoals: readonly string[]
}


class GoalsSelectionEditor
  extends React.PureComponent<GoalsSelectionEditorProps, GoalsSelectionEditorState> {
  public static propTypes = {
    goals: PropTypes.array.isRequired,
    isFirstTime: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    reachedGoals: PropTypes.objectOf(PropTypes.bool),
    shouldSubmitOnChange: PropTypes.bool,
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
    {reachedGoals = {}}, {reachedGoals: previousReachedGoals}):
    GoalsSelectionEditorState|Pick<GoalsSelectionEditorState, 'reachedGoals'>|null {
    if (reachedGoals !== previousReachedGoals) {
      const goalChanged = (goalId): boolean =>
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

  private handleGoalsChange = (selectedGoals): void => this.setState({selectedGoals}, (): void => {
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
    const {goals, isFirstTime, shouldSubmitOnChange} = this.props
    const options = goals.map(({content, goalId}): {name: React.ReactNode; value: string} => ({
      name: <Markdown content={content} isSingleLine={true} />,
      value: goalId,
    }))
    const containerStyle: React.CSSProperties = {
      fontSize: 15,
      padding: isMobileVersion ? 0 : '35px 50px',
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
        checkboxStyle={GoalsSelectionEditor.itemStyle} selectedCheckboxStyle={selectedItemStyle} />
      {shouldSubmitOnChange ? null :
        <Button onClick={this.handleSubmit} style={buttonStyle} isRound={true} type="validation">
          {isFirstTime ? 'Valider' : 'Enregistrer'}
        </Button>}
    </div>
  }
}


interface GoalsSelectionModalProps extends Omit<ModalConfig, 'children'> {
  children?: never
  dispatch: DispatchAllActions
  goals: readonly StrategyGoal[]
  isFirstTime?: boolean
  onSubmit: (reachedGoals: {[goalId: string]: boolean}) => void
  reachedGoals: {[goalId: string]: boolean}
  userYou: YouChooser
}


class GoalsSelectionModal extends React.PureComponent<GoalsSelectionModalProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    goals: PropTypes.arrayOf(PropTypes.shape({
      content: PropTypes.string.isRequired,
      goalId: PropTypes.string.isRequired,
    })).isRequired,
    isFirstTime: PropTypes.bool,
    isShown: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    reachedGoals: PropTypes.objectOf(PropTypes.bool).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {dispatch, goals, isFirstTime, onSubmit, reachedGoals, userYou,
      ...otherProps} = this.props
    const style = {
      borderRadius: 10,
    }
    return <Modal
      style={style} {...otherProps} title={<GoalsSelectionTitle {...{isFirstTime, userYou}} />}>
      <GoalsSelectionEditor {...{dispatch, goals, isFirstTime, onSubmit, reachedGoals, userYou}} />
    </Modal>
  }
}


const mobileSectionHeaderStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: 11,
  fontWeight: 'bold',
  textTransform: 'uppercase',
}


interface GoalsSelectionTabProps extends bayes.bob.WorkingStrategy, GoalsSelectionEditorProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  userYou: YouChooser
}


class GoalsSelectionTab
  extends React.PureComponent<GoalsSelectionTabProps, {isModalShown: boolean}> {
  public static propTypes = {
    onSubmit: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isModalShown: false,
  }

  private handleShowModal = _memoize((isModalShown): (() => void) => (): void =>
    this.setState({isModalShown}))

  public render(): React.ReactNode {
    const {coachingEmailFrequency, goals, lastModifiedAt, reachedGoals = {}, startedAt, onSubmit,
      userYou, ...otherProps} = this.props
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
    const percent = Math.round(getStrategyProgress(goals, reachedGoals))
    const coachingStyle = {
      alignItems: 'center',
      display: 'flex',
      fontSize: 14,
      marginBottom: 15,
      padding: '20px 0',
    }
    const {name: coaching = ''} =
      FOLLOWUP_EMAILS_OPTIONS.find(({value}): boolean => value === coachingEmailFrequency) || {}
    return <React.Fragment>
      <CoachingModal isShown={this.state.isModalShown} onClose={this.handleShowModal(false)} />
      <div style={progressStyle}>
        <div style={{flex: 1}}>
          État de l'objectif
          <PercentBar
            color={colors.GREENISH_TEAL} height={6} percent={percent}
            style={{marginTop: 10}} isPercentShown={false} />
        </div>
        <div style={{fontSize: 22, marginLeft: 25}}>{percent}%</div>
      </div>
      <section>
        <header style={mobileSectionHeaderStyle}>Mon coaching</header>
        <div style={coachingStyle} onClick={this.handleShowModal(true)}>
          <div style={{flex: 1}}>Type de coaching</div>
          <div style={{fontStyle: 'italic', fontWeight: 'bold', margin: 10}}>
            {coaching || 'Désactivé'}
          </div>
          <ChevronRightIcon size={20} color={colors.COOL_GREY} />
        </div>
      </section>
      <section>
        <header style={mobileSectionHeaderStyle}>Mes objectifs</header>
        <GoalsSelectionEditor
          {...otherProps} shouldSubmitOnChange={true} isFirstTime={!startedAt}
          {...{goals, onSubmit, reachedGoals, userYou}} />
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
}


interface MethodProps {
  advice: bayes.bob.Advice & {adviceId: string}
  style?: React.CSSProperties
  userYou: YouChooser
}
class ObservationMethod extends React.PureComponent<MethodProps> {
  public render(): React.ReactNode {
    const {advice, advice: {adviceId}, style, userYou} = this.props
    const containerStyle: React.CSSProperties = {
      ...strategyCardStyle,
      fontSize: 13,
      fontWeight: 'bold',
      height: 190,
      padding: '20px 15px',
      textAlign: 'center',
      width: 140,
      ...style,
    }
    return <div style={containerStyle}>
      <AdvicePicto adviceId={adviceId} style={{marginBottom: 20, width: 64}} />
      <div>{upperFirstLetter(getAdviceGoal(advice, userYou))}</div>
    </div>
  }
}

interface StratPanelProps extends React.HTMLProps<HTMLDivElement> {
  title: string
}

class StratPanel extends React.PureComponent<StratPanelProps> {
  public render(): React.ReactNode {
    const {children, title, ...otherProps} = this.props
    const titleStyle: React.CSSProperties = isMobileVersion ? {
      fontSize: 22,
      margin: '0 0 15px',
    } : {
      borderBottom: strategyCardStyle.border,
      fontSize: 22,
      margin: '0 0 25px',
      paddingBottom: 20,
    }
    return <section {...otherProps}>
      <h2 style={titleStyle}>{title}</h2>
      {children}
    </section>
  }
}


class ScorePanel extends React.PureComponent<{score: number; style: React.CSSProperties}> {
  public render(): React.ReactNode {
    const {score, style} = this.props
    const scoreCardStyle = {
      alignItems: 'center',
      backgroundColor: colors.DARK_TWO,
      borderRadius: 20,
      boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
      display: 'flex',
      padding: '45px 20px',
    }
    const scoreDeltaStyle = {
      color: '#fff',
      fontSize: 24,
      marginBottom: 6,
    }
    const {color: scoreColor, impact: scoreImpact} = impactFromPercentDelta(score)
    return <StratPanel title="Impact sur mon score" style={style}>
      <div style={scoreCardStyle}>
        <BobScoreCircle
          isPercentShown={false} radius={41} strokeWidth={3} percent={score}
          startColor={colors.BOB_BLUE} color={colors.BOB_BLUE} isCaptionShown={false} />
        <div style={{color: scoreColor, fontSize: 13, fontWeight: 'bold'}}>
          <div style={scoreDeltaStyle}>
            +<GrowingNumber isSteady={true} number={score} />%
          </div>
          Impact {scoreImpact}
        </div>
      </div>
    </StratPanel>
  }
}


interface EngagementProps {
  gender?: bayes.bob.Gender
  handleEngagement: () => void
  style?: React.CSSProperties
}

class EngagementContent extends
  React.PureComponent<EngagementProps, {selectedReadyOptions: string[]}> {

  public state = {
    selectedReadyOptions: [],
  }

  private handleReadyChange = (selectedReadyOptions): void => {
    this.setState({selectedReadyOptions})
  }

  public render(): React.ReactNode {
    const {gender, handleEngagement, style} = this.props
    const {selectedReadyOptions} = this.state
    const checkboxStyle = isMobileVersion ? {
      borderBottom: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      padding: '20px 0',
    } : {
      marginBottom: 10,
    }
    return <div style={style}>
      <CheckboxList
        onChange={this.handleReadyChange}
        options={makeStartStrategyOptions(genderize('·e', 'e', '', gender))}
        values={selectedReadyOptions}
        checkboxStyle={checkboxStyle} style={isMobileVersion ? {} : {marginTop: 15}} />
      <Button
        onClick={handleEngagement} isRound={true} style={{marginTop: 25}}
        disabled={selectedReadyOptions.length < startStrategyOptionsCount}>
        Commencer ma stratégie
      </Button>
    </div>
  }
}


interface TabProps {
  baseUrl: string
  icon: string
  selectedIcon: string
  shownTab?: string
  style?: React.CSSProperties
  tab: string
}

class MobileTab extends React.PureComponent<TabProps> {
  public render(): React.ReactNode {
    const {baseUrl, children, icon, selectedIcon, shownTab, style, tab} = this.props
    const isSelected = shownTab === tab
    const tabStyle: React.CSSProperties = {
      alignItems: 'center',
      color: isSelected ? colors.BOB_BLUE : colors.COOL_GREY,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textDecoration: 'none',
      ...style,
    }
    return <Link to={`${baseUrl}/${tab}`} style={tabStyle}>
      <img src={isSelected ? selectedIcon : icon} alt="" style={{marginBottom: 3}} />
      {children}
    </Link>
  }
}


interface StrategyPageConnectedProps {
  goals: readonly StrategyGoal[]
  isGuest: boolean
  methods: readonly [ValidAdvice, string|undefined][]
  openedStrategy: bayes.bob.WorkingStrategy & {strategyId: string}
  profile: bayes.bob.UserProfile
  testimonials: readonly StrategyTestimonial[]
  userYou: YouChooser
}


export interface StrategyPageParams {
  adviceId?: string
  strategyId?: string
}


interface StrategyPageConfig extends RouteComponentProps<StrategyPageParams> {
  project: bayes.bob.Project
  projectUrl: string
  strategy: bayes.bob.Strategy & {strategyId: string}
  strategyRank: number
  strategyUrl: string
}


interface StrategyPageProps
  extends StrategyPageConnectedProps, StrategyPageConfig {
  dispatch: DispatchAllActions
}


interface StrategyPageState {
  areAllMethodsShown: boolean
  isEngagementModalShown: boolean
  isGoalsSelectionModalShown: boolean
}


class StrategyPageBase extends React.PureComponent<StrategyPageProps, StrategyPageState> {
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
    userYou: PropTypes.func.isRequired,
  }

  public state: StrategyPageState = {
    areAllMethodsShown: false,
    isEngagementModalShown: false,
    isGoalsSelectionModalShown: false,
  }

  public componentDidMount(): void {
    const {dispatch, openedStrategy: {startedAt}, project, strategy, strategyRank} = this.props
    if (startedAt) {
      dispatch(strategyWorkPageIsShown(project, strategy, strategyRank))
    } else {
      dispatch(strategyExplorationPageIsShown(project, strategy, strategyRank))
    }
  }

  public componentDidUpdate(): void {
    if (this.props.match.params.adviceId === 'objectifs' && this.state.isGoalsSelectionModalShown) {
      this.hideGoalsSelectionModal()
    }
  }

  private handleEngagement = (): void => {
    if (!isMobileVersion) {
      this.setState({isGoalsSelectionModalShown: true})
      return
    }
    this.setState({isEngagementModalShown: false})
    this.handleGoalsSelection({})
  }

  private handleGoalsSelection = (reachedGoals): void => {
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
    if (!isMobileVersion) {
      this.hideGoalsSelectionModal()
      window.scrollTo({behavior: 'smooth', top: 0})
    }
  }

  private hideGoalsSelectionModal = (): void => {
    this.setState({isGoalsSelectionModalShown: false})
  }

  private handleShowAllMethods = (): void => this.setState({areAllMethodsShown: true})

  private handleShowEngagementModal = _memoize((isEngagementModalShown): (() => void) => (): void =>
    this.setState({isEngagementModalShown}))

  private renderNavBarContent(): JSX.Element {
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
        <ArrowLeftIcon size={24} style={{marginRight: 25}} />Diagnostic
      </Link>
    </div>
  }

  private renderMobileObservation = (): React.ReactNode => {
    const {goals, methods, profile: {gender}, projectUrl, strategy: {score}, testimonials,
      userYou} = this.props
    // TODO(cyrille): Move this logic inside SwipeableList.
    const methodsByPage = Math.floor(window.innerWidth / 155)
    const goalStyle: React.CSSProperties = {
      ...strategyCardStyle,
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      fontStyle: 'italic',
      justifyContent: 'center',
      minHeight: 100,
      padding: '20px 37px 20px 33px',
      textAlign: 'center',
    }
    const engageButtonStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      bottom: 0,
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 15,
      height: 50,
      justifyContent: 'center',
      left: 0,
      position: 'fixed',
      right: 0,
    }
    const engageChevronStyle: React.CSSProperties = {
      position: 'absolute',
      right: 20,
    }
    const testimonialsStyle: React.CSSProperties = {
      backgroundColor: colors.PALE_BLUE,
      fontSize: 13,
      margin: '0 -15px',
      padding: '25px 15px',
    }
    const modalContentStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 20px 30px',
    }
    const methodStyle = (index: number): React.CSSProperties => ({
      flex: 1,
      marginLeft: index % methodsByPage ? 10 : 0,
    })
    return <PageWithNavigationBar
      page="strategie" onBackClick={projectUrl} isLogoShown={true}
      style={{backgroundColor: '#fff', padding: '25px 15px 50px'}}
      navBarContent={this.renderNavBarContent()}>
      <Modal
        title="Avant de me lancer" isShown={this.state.isEngagementModalShown}
        style={{margin: '0 20px'}} onClose={this.handleShowEngagementModal(false)}>
        <EngagementContent
          style={modalContentStyle} gender={gender} handleEngagement={this.handleEngagement} />
      </Modal>
      {score ? <ScorePanel score={score} style={{marginBottom: 35}} /> : null}
      <StratPanel title="Objectifs de la stratégie" style={{marginBottom: 30}}>
        <SwipeableList>
          {goals.map(({content, goalId}): ReactStylableElement =>
            <div key={goalId} style={goalStyle}>
              <Markdown content={content} isSingleLine={true} />
            </div>)}
        </SwipeableList>
      </StratPanel>
      <StratPanel title="Sujets à travailler" style={{marginBottom: 35}}>
        <SwipeableList childrenByPage={methodsByPage}>
          {methods.map(([advice], index): ReactStylableElement => <ObservationMethod
            style={methodStyle(index)} key={advice.adviceId} {...{advice, userYou}} />)}
        </SwipeableList>
      </StratPanel>
      {testimonials.length ? <StratPanel
        style={testimonialsStyle} title={`Témoignage${testimonials.length > 1 ? 's' : ''}`}>
        {testimonials.map((testimonial, index): React.ReactNode => <Testimonial
          key={index} {...testimonial}
          style={index ? {borderTop: `solid 1px ${colors.MODAL_PROJECT_GREY}`} : {}} />)}
      </StratPanel> : null}
      <div onClick={this.handleShowEngagementModal(true)} style={engageButtonStyle}>
        Je suis prêt{genderize('·e', 'e', '', gender)} à me lancer
        <ChevronRightIcon style={engageChevronStyle} size={20} />
      </div>
    </PageWithNavigationBar>
  }

  // TODO(cyrille): Split in two (observation + working).
  private renderDesktop(): React.ReactNode {
    const {
      dispatch,
      goals,
      isGuest,
      methods,
      openedStrategy, openedStrategy: {reachedGoals = {}, startedAt},
      profile: {gender},
      project,
      projectUrl,
      strategy, strategy: {score, strategyId, title},
      testimonials,
      userYou,
    } = this.props
    const isSignUpBannerShown = startedAt && isGuest
    const {areAllMethodsShown, isGoalsSelectionModalShown} = this.state
    const titleStyle = {
      fontSize: 33,
      marginBottom: 10,
      marginTop: 50,
    }
    const contentStyle: React.CSSProperties = {
      ...!isMobileVersion && {display: 'flex'},
      justifyContent: 'space-between',
      margin: '0 auto',
      maxWidth: 1000,
      padding: isMobileVersion ? 15 : 20,
    }
    const goalsSectionStyle: React.CSSProperties = isMobileVersion ? {
      paddingBottom: 45,
    } : {
      position: 'relative',
    }
    const dateStyle: React.CSSProperties = {
      fontSize: 11,
      fontStyle: 'italic',
      marginLeft: 10,
    }
    const testimonialStyle = {
      borderTop: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    }
    const lastAdviceRow = areAllMethodsShown ?
      Math.ceil(methods.length / METHODS_PER_ROW) - 1 : 0
    const methodsListStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    }
    const moreMethodsStyle: React.CSSProperties = {
      alignItems: 'center',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      justifyContent: 'center',
      margin: '10px 0',
    }
    const bottomPanelStyle = {
      backgroundColor: colors.PALE_BLUE,
      padding: '60px 0',
    }
    const testimonialsStyle = {
      margin: '0 auto',
      maxWidth: 1000,
      padding: '0 20px',
    }
    const methodStyle = (index): React.CSSProperties => ({
      marginBottom: Math.floor(index / METHODS_PER_ROW) === lastAdviceRow ? 0 : 25,
    })
    return <PageWithNavigationBar
      page="strategie" navBarContent={this.renderNavBarContent()} isLogoShown={isMobileVersion}
      onBackClick={projectUrl} style={{backgroundColor: '#fff'}}>
      {startedAt || isGoalsSelectionModalShown ? null :
        <FastForward onForward={this.handleEngagement} />}
      {isSignUpBannerShown ?
        <SignUpBanner style={{margin: '50px auto 0', width: 1000}} userYou={userYou} /> : null}
      {isMobileVersion ? null : <React.Fragment>
        <GoalsSelectionModal
          goals={goals} isFirstTime={!startedAt} userYou={userYou} reachedGoals={reachedGoals}
          onSubmit={this.handleGoalsSelection} isShown={isGoalsSelectionModalShown}
          onClose={this.hideGoalsSelectionModal} dispatch={dispatch} />
        <header
          style={{margin: '0 auto 35px', maxWidth: 1000, padding: '0 20px'}}>
          <h1 style={titleStyle}>{title}</h1>
          <div style={{alignItems: 'center', display: 'flex'}}>
            <WhyButton strategy={strategy} />
            {startedAt ? <div style={dateStyle}>Commencé le {getDateString(startedAt)}</div> : null}
          </div>
        </header>
      </React.Fragment>}
      <div style={contentStyle}>
        <div style={{flex: 1}}>
          {/* TODO(cyrille): Replace the goals panel on mobile by new mobile UI. */}
          {startedAt ? null : <StrategySection
            title="Objectifs de cette stratégie" style={goalsSectionStyle}>
            <StrategyGoalsList
              goals={goals} reachedGoals={reachedGoals} style={{marginTop: 25}} />
            {startedAt || isMobileVersion ? null : <div style={{marginTop: 55}}>
              <span style={{color: colors.BOB_BLUE, fontStyle: 'italic', fontWeight: 'bold'}}>
                Avant de me lancer&nbsp;:
              </span>
              <EngagementContent gender={gender} handleEngagement={this.handleEngagement} />
            </div>}
          </StrategySection>}
          {startedAt ?
            <StrategySection title="Méthodes">
              {methods.map(([advice, teaser], index): React.ReactNode => <WorkingMethod
                key={advice.adviceId} style={{marginTop: index ? 60 : 25}} title={teaser}
                {...{advice, project, strategyId, userYou}} />)}
            </StrategySection> : null}
        </div>
        {isMobileVersion ? null : startedAt ?
          <GoalsPanel
            userYou={userYou} style={{flex: 'none', width: RIGHT_PANEL_WIDTH}}
            handleEngagement={this.handleEngagement} openedStrategy={openedStrategy} /> :
          <div style={{width: RIGHT_PANEL_WIDTH}}>
            {score ? <ScorePanel score={score} style={{marginBottom: 40}} /> : null}
            <StratPanel title="Sujets à travailler">
              <AppearingList
                maxNumChildren={areAllMethodsShown ? 0 : METHODS_PER_ROW} style={methodsListStyle}>
                {methods.map(([advice], index): ReactStylableElement =>
                  <ObservationMethod
                    key={advice.adviceId} {...{advice, userYou}} style={methodStyle(index)} />)}
              </AppearingList>
              {areAllMethodsShown || methods.length <= METHODS_PER_ROW ? null :
                <div style={moreMethodsStyle} onClick={this.handleShowAllMethods}>
                  Voir plus <ChevronDownIcon size={20} />
                </div>}
            </StratPanel>
          </div>}
      </div>
      {testimonials.length && !startedAt ?
        <div style={bottomPanelStyle}>
          <div style={testimonialsStyle}>
            <StratPanel
              style={{maxWidth: LEFT_PANEL_WIDTH}}
              title={`Témoignage${testimonials.length > 1 ? 's' : ''}`}>
              {testimonials.map((testimonial, index): React.ReactNode => <Testimonial
                key={`testimonial-${index}`} {...testimonial}
                style={index ? testimonialStyle : {}} />)}
            </StratPanel>
          </div>
        </div> : null}
    </PageWithNavigationBar>
  }

  private renderGoalsTab = (): React.ReactNode => {
    const {
      goals,
      isGuest,
      openedStrategy,
      profile: {coachingEmailFrequency},
      userYou,
    } = this.props
    return <React.Fragment>
      {isGuest ? <SignUpBanner style={{margin: '10px auto'}} userYou={userYou} /> : null}
      <GoalsSelectionTab
        goals={goals} {...openedStrategy} userYou={userYou}
        coachingEmailFrequency={coachingEmailFrequency} onSubmit={this.handleGoalsSelection} />
    </React.Fragment>
  }

  private renderMethodsList =
  (methods: readonly [ValidAdvice, string|undefined][], isRead?: boolean): React.ReactNode => {
    if (!methods.length) {
      return null
    }
    const adviceStyle = (index): React.CSSProperties => ({
      alignItems: 'center',
      borderTop: index ? `1px solid ${colors.MODAL_PROJECT_GREY}` : 'none',
      color: 'inherit',
      display: 'flex',
      fontSize: 14,
      fontWeight: isRead ? 'initial' : 'bold',
      padding: '20px 15px 20px 0',
      textDecoration: 'none',
    })
    const maybeS = methods.length === 1 ? '' : 's'
    return <section>
      <header style={mobileSectionHeaderStyle}>{isRead ? 'C' : 'Non c'}onsultée{maybeS}</header>
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
      strategyUrl} = this.props
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
          Objectifs
        </MobileTab>
        <MobileTab
          tab="methodes" baseUrl={strategyUrl} shownTab={shownTab} style={tabStyle}
          icon={methodsIcon} selectedIcon={selectedMethodsIcon}>
          Méthodes
        </MobileTab>
      </div>
    </PageWithNavigationBar>
  }

  public render(): React.ReactNode {
    const {match: {params: {adviceId}}, openedStrategy: {startedAt = ''} = {},
      strategyUrl} = this.props
    if (isMobileVersion) {
      if (startedAt) {
        return this.renderStartedMobile()
      }
      return this.renderMobileObservation()
    }
    if (adviceId) {
      return <Redirect to={strategyUrl} />
    }
    return this.renderDesktop()
  }
}
type ValidStrategyAdvice = bayes.bob.StrategyAdvice & {adviceId: string}
const StrategyPage = connect(
  (
    {user, user: {hasAccount, profile = {}}}: RootState,
    {
      project, project: {advices = []} = {},
      strategy: {piecesOfAdvice = [], strategyId},
    }: StrategyPageConfig,
  ): StrategyPageConnectedProps => {
    const userYou = youForUser(user)
    const validAdvices =
      advices.filter((a: bayes.bob.Advice): a is ValidAdvice => a && !!a.adviceId)
    const advicesById = _keyBy(validAdvices, 'adviceId')
    const methods = piecesOfAdvice.
      filter((a): a is ValidStrategyAdvice => !!(a.adviceId && advicesById[a.adviceId])).
      map(({adviceId, teaser}): [ValidAdvice, string|undefined] => [advicesById[adviceId], teaser])
    const goals = getStrategyGoals(userYou, strategyId)
    const testimonials = getStrategiesTestimonials(userYou)[strategyId] || []
    return {
      goals,
      isGuest: !hasAccount,
      methods,
      openedStrategy: getStartedStrategy(project, strategyId),
      profile,
      testimonials,
      userYou,
    }
  })(StrategyPageBase)


interface TestimonialProps extends StrategyTestimonial {
  style?: React.CSSProperties
}


class Testimonial extends React.PureComponent<TestimonialProps> {
  public static propTypes = {
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    isMale: PropTypes.bool,
    job: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    rating: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {content, createdAt, job, isMale, name, rating, style} = this.props
    const picture = isMale ? manImage : womanImage
    const pictureSize = 35
    const pictureMargin = 15
    const createdMonthsFromNow = getDiffBetweenDatesInString(new Date(createdAt), new Date())
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      justifyContent: 'flex-start',
      maxWidth: 600,
      padding: '25px 0 30px',
      ...style,
    }
    const starStyle = {
      fill: colors.SUN_YELLOW,
      height: 20,
      width: 20,
    }
    const pictureStyle: React.CSSProperties = {
      maxHeight: pictureSize,
      maxWidth: pictureSize,
      width: 'auto',
    }
    const dateStyle: React.CSSProperties = {
      color: colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'italic',
    }

    return <div style={containerStyle}>
      <div style={{display: 'flex'}}>
        <img src={picture} alt="" style={pictureStyle} />
        <div style={{flex: 1, margin: `0 ${pictureMargin}px ${pictureMargin}px`}}>
          <div>
            <span style={{fontWeight: 'bold', paddingRight: 2}}>{name}</span>
            <span style={{color: colors.COOL_GREY, width: 4}}>&bull;</span>
            <span style={{fontStyle: 'italic', paddingLeft: 5}}>{job}</span>
          </div>
          <div style={{alignItems: 'center', display: 'flex'}}>
            <span style={{display: 'flex', marginRight: 14}}>
              {new Array(rating).fill(null).map((unused, index): React.ReactNode =>
                <StarIcon style={starStyle} key={`star-${index}`} />)}
            </span>
            <span style={dateStyle}>
              {createdMonthsFromNow}
            </span>
          </div>
        </div>
      </div>
      <div style={{paddingLeft: pictureSize + pictureMargin}}>{content}</div>
    </div>
  }
}

export {Strategies, StrategyPage}
