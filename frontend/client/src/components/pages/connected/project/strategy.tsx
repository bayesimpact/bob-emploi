import _fromPairs from 'lodash/fromPairs'
import _isEqual from 'lodash/isEqual'
import _keyBy from 'lodash/keyBy'
import _memoize from 'lodash/memoize'
import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import StarIcon from 'mdi-react/StarIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'
import VisibilitySensor from 'react-visibility-sensor'

import {DispatchAllActions, RootState, displayToasterMessage, FINISH_PROFILE_SETTINGS,
  setUserProfile, startStrategy, replaceStrategy, strategyWorkPageIsShown,
  strategyExplorationPageIsShown} from 'store/actions'
import {StrategyGoal, YouChooser, getDiffBetweenDatesInString, getDateString, getStrategiesGoals,
  getStrategiesTestimonials, tutoyer} from 'store/french'
import {getStrategy} from 'store/project'
import {colorFromPercent} from 'store/score'
import {youForUser} from 'store/user'

import {ObservationMethod, WorkingMethod} from 'components/advisor'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {FieldSet, CheckboxList, Select} from 'components/pages/connected/form_utils'
import {Button, Markdown, PercentBar, SmoothTransitions, colorToAlpha} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'
import manImage from 'images/man-icon.svg'
import womanImage from 'images/woman-icon.svg'

import {BobModal} from './speech'

const FOLLOWUP_EMAILS_OPTIONS = [
  {name: 'De temps en temps', value: 'EMAIL_ONCE_A_MONTH'},
  {name: 'Autant que possible', value: 'EMAIL_MAXIMUM'},
  {name: 'Jamais', value: 'EMAIL_NONE'},
]

const getStrategyProgress = (goals, reachedGoals): number => {
  const numReachedGoals = Object.keys(reachedGoals).
    filter((goalId): boolean => reachedGoals[goalId]).length
  return numReachedGoals * 100 / goals.length
}

interface WhyButtonProps {
  onClick: (event: React.MouseEvent) => void
  style?: React.CSSProperties
}

class WhyButtonBase extends React.PureComponent<WhyButtonProps> {
  public static propTypes = {
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {onClick, style} = this.props
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
    return <div style={buttonStyle} onClick={onClick}>
      <img src={bobHeadImage} alt={config.productName} style={bobStyle} />
      L'explication de {config.productName}
    </div>
  }
}
const WhyButton = Radium(WhyButtonBase)


interface StrategyConfig {
  chevronSize?: number
  pageUrl: string
  project: bayes.bob.Project
  score?: number
  strategyId?: string
  style?: React.CSSProperties
  title?: string
}

interface StrategyProps extends StrategyConfig {
  chevronSize: number
}


interface StrategyCompletion {
  isComplete: boolean
  isStarted: boolean
  progress: number
}


interface StrategyState {
  isHovered: boolean
  isWhyModalShown: boolean
}


class Strategy extends React.PureComponent<StrategyProps, StrategyState> {
  public static propTypes = {
    chevronSize: PropTypes.number.isRequired,
    pageUrl: PropTypes.string.isRequired,
    project: PropTypes.object.isRequired,
    score: PropTypes.number,
    strategyId: PropTypes.string,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
  }

  public static defaultProps = {
    chevronSize: 24,
  }

  public state: StrategyState = {
    isHovered: false,
    isWhyModalShown: false,
  }

  private handleSetHovered = _memoize((isHovered): (() => void) =>
    (): void => this.setState({isHovered}))

  private handleClickWhy = (event): void => {
    event.preventDefault()
    event.stopPropagation()
    this.setState({isWhyModalShown: true})
  }

  private handleCloseModal = (): void => this.setState({isWhyModalShown: false})

  private getStrategyCompletion(): StrategyCompletion {
    const {project = {}, strategyId} = this.props
    const {startedAt, reachedGoals = {}} = getStrategy(project, strategyId)
    const isStarted = !!startedAt
    const goals = getStrategiesGoals(tutoyer)[strategyId] || []
    const progress = getStrategyProgress(goals, reachedGoals)
    const isComplete = progress === 100
    return {isComplete, isStarted, progress}
  }

  private renderCompleted(style?: React.CSSProperties): React.ReactNode {
    const {isComplete} = this.getStrategyCompletion()
    if (!isComplete) {
      return null
    }
    const completedStrategyStyle = {
      fill: colors.GREENISH_TEAL,
      ...style,
    }
    return <CheckCircleIcon size={30} style={completedStrategyStyle} />
  }

  private renderProgressBar(style: React.CSSProperties): React.ReactNode {
    const {isComplete, isStarted, progress} = this.getStrategyCompletion()
    const percentWidth = isMobileVersion ? {} : {width: 100}
    if (isComplete || !isStarted) {
      return null
    }
    const percentStyle = {
      marginRight: 10,
      ...percentWidth,
      ...style,
    }
    return <PercentBar percent={progress} color={colors.DARK_TWO} height={6} style={percentStyle} />
  }

  public render(): React.ReactNode {
    const {chevronSize, pageUrl, project: {strategies}, score, strategyId, style,
      title} = this.props
    const {isHovered, isWhyModalShown} = this.state
    const {header: why} = strategies.
      find(({strategyId: sId}): boolean => sId === strategyId)
    const {isStarted} = this.getStrategyCompletion()
    const scoreStyle: React.CSSProperties = {
      // TODO(marielaure): Find a better golden number to switch from
      // improvement scores to scores for color.
      color: colorFromPercent(score * 4),
      fontSize: 20,
      fontStyle: isMobileVersion ? 'normal' : 'italic',
      fontWeight: 'bold',
      margin: isMobileVersion ? 0 : '2px 0 0',
    }
    const containerStyle: React.CSSProperties = {
      borderRadius: 10,
      color: 'inherit',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      padding: isMobileVersion ? 20 : '30px 40px',
      textDecoration: 'none',
      ...style,
    }
    const titleStyle: React.CSSProperties = {
      flex: 1,
      fontSize: 18,
      fontWeight: 'bold',
      margin: 0,
      paddingRight: 5,
    }
    const titleContainerStyle: React.CSSProperties = {
      flex: 1,
      ...isMobileVersion && {
        alignItems: 'center',
        display: 'flex',
      },
    }
    const chevronStyle = {
      marginRight: -.3 * chevronSize,
    }
    const whyStyle = {
      marginLeft: 10,
      opacity: isHovered ? 1 : 0,
      ...SmoothTransitions,
    }
    return <React.Fragment>
      {why ? <BobModal onConfirm={this.handleCloseModal} isShown={isWhyModalShown} buttonText="OK">
        {why}
      </BobModal> : null}
      <Link
        onMouseOver={this.handleSetHovered(true)} onMouseLeave={this.handleSetHovered(false)}
        to={pageUrl} style={containerStyle}>
        <div style={{alignItems: 'center', display: 'flex'}}>
          <div style={titleContainerStyle}>
            <h2 style={titleStyle}>{title}</h2>
            <div style={{display: 'flex', marginTop: 5}}>
              {isMobileVersion && isStarted ? this.renderCompleted() :
                <h2 style={{...scoreStyle, flexShrink: 0}}>+{score}%</h2>}
              {why && !isMobileVersion ?
                <WhyButton style={whyStyle} onClick={this.handleClickWhy} /> : null}
            </div>
          </div>
          {isMobileVersion ? null : this.renderProgressBar({marginRight: 10})}
          {isMobileVersion ? null : this.renderCompleted({marginRight: 10})}
          <ChevronRightIcon color={colors.SLATE} size={chevronSize} style={chevronStyle} />
        </div>
        {isMobileVersion ? this.renderProgressBar({marginTop: 10}) : null}
      </Link>
    </React.Fragment>
  }
}


interface StrategiesProps extends
  Omit<StrategyConfig, 'style' | 'pageUrl' | keyof bayes.bob.Strategy> {
  makeStrategyLink: (strategyId: string) => string
  strategies: bayes.bob.Strategy[]
  strategyStyle?: React.CSSProperties
}


class Strategies extends React.PureComponent<StrategiesProps> {
  public static propTypes = {
    makeStrategyLink: PropTypes.func.isRequired,
    strategies: PropTypes.arrayOf(PropTypes.shape({
      score: PropTypes.number,
      strategyId: PropTypes.string,
      title: PropTypes.string,
    })).isRequired,
    strategyStyle: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {makeStrategyLink, strategies, strategyStyle, ...otherProps} = this.props
    const combinedStrategyStyle = {
      alignSelf: 'stretch',
      marginBottom: 20,
      ...strategyStyle,
    }
    return <React.Fragment>
      {strategies.map((strategy, index): React.ReactNode => <Strategy
        key={index} style={combinedStrategyStyle} {...strategy}
        pageUrl={makeStrategyLink(strategy.strategyId)}
        {...otherProps} />)}
    </React.Fragment>
  }
}


interface BannerProps {
  baseUrl: string
  maxInnerWidth: number
  onStart: () => void
  userYou: YouChooser
}


class StartBanner extends React.PureComponent<BannerProps, {isFixed: boolean}> {
  public static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    maxInnerWidth: PropTypes.number.isRequired,
    onStart: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public static defaultProps = {
    maxInnerWidth: 600,
  }

  public state = {
    isFixed: true,
  }

  private handleVisibilityChange = (isVisible): void => this.setState({isFixed: !isVisible})

  private renderContent(): React.ReactNode {
    const {baseUrl, maxInnerWidth, onStart, userYou} = this.props
    const sidePadding = 30
    const contentStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      margin: '0 auto',
      maxWidth: maxInnerWidth + 2 * sidePadding,
      padding: `15px ${sidePadding}px`,
    }
    const buttonStyle: React.CSSProperties = isMobileVersion ? {padding: '9px 25px'} : {}
    return <div style={contentStyle}>
      <span style={{flex: 1, maxWidth: isMobileVersion ? 200 : 'initial', textAlign: 'center'}}>
        {userYou('Veux-tu te', 'Voulez-vous vous')} lancer dans cette stratégie&nbsp;?
      </span>
      <div style={{display: 'flex', marginTop: isMobileVersion ? 10 : 0}}>
        <Button style={buttonStyle} onClick={onStart} isRound={true} type="navigation">Oui</Button>
        <Link to={baseUrl}>
          <Button style={{...buttonStyle, marginLeft: 15}} isRound={true} type="navigation">
            Plus tard
          </Button>
        </Link>
      </div>
    </div>
  }

  public render(): React.ReactNode {
    const {isFixed} = this.state
    const border = `solid 1px ${colorToAlpha(colors.BOB_BLUE, .2)}`
    const maxWidth = 660
    const containerStyle: React.CSSProperties = {
      backgroundColor: colors.PALE_BLUE,
      ...SmoothTransitions,
    }
    const inFlowStyle: React.CSSProperties = {
      ...containerStyle,
      border,
      borderRadius: 10,
      margin: `0 auto ${isMobileVersion ? '' : '80px'}`,
      maxWidth,
      visibility: isMobileVersion ? 'hidden' : 'initial',
    }
    const fixedStyle: React.CSSProperties = {
      ...containerStyle,
      borderTop: border,
      bottom: 0,
      left: 0,
      position: 'fixed',
      right: 0,
      transform: `translateY(${isFixed ? 0 : 100}%)`,
      zIndex: 1,
    }
    return <React.Fragment>
      <div style={fixedStyle}>{this.renderContent()}</div>
      <VisibilitySensor
        active={!isMobileVersion} intervalDelay={250} onChange={this.handleVisibilityChange}>
        <div style={inFlowStyle}>{this.renderContent()}</div>
      </VisibilitySensor>
    </React.Fragment>
  }
}


interface SectionProps extends React.HTMLProps<HTMLDivElement> {
  picto?: React.ReactNode
  title: string
}


class StrategySection extends React.PureComponent<SectionProps> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    picto: PropTypes.node,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {children, picto, style, title, ...otherProps} = this.props
    const sectionStyle = {
      margin: '0 auto 60px',
      maxWidth: 600,
      ...style,
    }
    const headerStyle = {
      alignItems: 'center',
      borderBottom: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      fontSize: 26,
      justifyContent: 'space-between',
      paddingBottom: 25,
    }
    return <section style={sectionStyle} {...otherProps}>
      <header style={headerStyle}>
        <span>{title}</span><span>{picto}</span>
      </header>
      {children}
    </section>
  }
}


interface GoalsProps {
  goals: StrategyGoal[]
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
        <div style={discStyle}>•</div>}
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


interface GoalsSelectionEditorConfig {
  goals: StrategyGoal[]
  isFirstTime?: boolean
  onSubmit: (reachedGoals: {[goalId: string]: boolean}) => void
  reachedGoals: {[goalId: string]: boolean}
}


interface GoalsSelectionEditorConnectedProps {
  coachingEmailFrequency: bayes.bob.EmailFrequency
}


interface GoalsSelectionEditorProps
  extends GoalsSelectionEditorConnectedProps, GoalsSelectionEditorConfig {
  dispatch: DispatchAllActions
}


interface GoalsSelectionEditorState {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  reachedGoals?: {[goalId: string]: boolean}
  selectedGoals?: string[]
}


class GoalsSelectionEditorBase
  extends React.PureComponent<GoalsSelectionEditorProps, GoalsSelectionEditorState> {
  public static propTypes = {
    coachingEmailFrequency: PropTypes.oneOf([
      'EMAIL_NONE', 'EMAIL_ONCE_A_MONTH', 'EMAIL_MAXIMUM',
    ] as const).isRequired,
    dispatch: PropTypes.func.isRequired,
    goals: PropTypes.array.isRequired,
    isFirstTime: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    reachedGoals: PropTypes.objectOf(PropTypes.bool).isRequired,
  }

  public state: GoalsSelectionEditorState = {
    coachingEmailFrequency: this.props.coachingEmailFrequency,
    reachedGoals: {},
    selectedGoals: [],
  }

  public static getDerivedStateFromProps(
    {reachedGoals}, {reachedGoals: previousReachedGoals}): GoalsSelectionEditorState {
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

  private handleGoalsChange = (selectedGoals): void => this.setState({selectedGoals})

  private handleEmailChange = (coachingEmailFrequency): void =>
    this.setState({coachingEmailFrequency})

  private handleClick = (): void => {
    const {dispatch, goals, onSubmit, coachingEmailFrequency: oldEmailFrequency} = this.props
    const {coachingEmailFrequency} = this.state
    const selectedGoalsSet = new Set(this.state.selectedGoals)
    const reachedGoals =
      _fromPairs(goals.map(({goalId}): [string, boolean] => [goalId, selectedGoalsSet.has(goalId)]))
    onSubmit(reachedGoals)
    const profileUpdate = {coachingEmailFrequency}
    if (oldEmailFrequency === coachingEmailFrequency) {
      return
    }
    dispatch(setUserProfile(profileUpdate, true, FINISH_PROFILE_SETTINGS)).
      then((success): void => {
        if (success) {
          dispatch(displayToasterMessage('Modifications sauvegardées.'))
        }
      })
  }

  private onForward = (): void => {
    const {goals, isFirstTime} = this.props
    if (!isFirstTime || this.state.selectedGoals.length) {
      this.handleClick()
      return
    }
    const selectedGoals = goals.
      filter((): boolean => Math.random() > .5).
      map(({goalId}): string => goalId)
    this.setState({selectedGoals})
  }

  public render(): React.ReactNode {
    const {goals, isFirstTime} = this.props
    const {coachingEmailFrequency} = this.state
    const options = goals.map(({content, goalId}): {name: React.ReactNode; value: string} => ({
      name: <Markdown content={content} isSingleLine={true} />,
      value: goalId,
    }))
    const containerStyle: React.CSSProperties = {
      fontSize: 15,
      padding: isMobileVersion ? 35 : '35px 50px',
    }
    const buttonStyle: React.CSSProperties = {
      display: 'block',
      margin: '55px auto 0',
    }
    const settingStyle: React.CSSProperties = {
      borderTop: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      marginTop: 35,
      paddingTop: 20,
    }
    return <div style={containerStyle}>
      <FastForward onForward={this.onForward} />
      <CheckboxList
        onChange={this.handleGoalsChange} options={options} values={this.state.selectedGoals}
        checkboxStyle={{marginBottom: 10}} />
      {isFirstTime ? null : <div style={settingStyle}>
        {/* TODO(marielaure): Put this on one line. */}
        {/* TODO(marielaure): Add a flag to keep the strategy for which the user needs coaching. */}
        <FieldSet
          label="Me rappeler d'avancer sur ce point :"
          isValid={!!coachingEmailFrequency}>
          <Select
            onChange={this.handleEmailChange}
            value={coachingEmailFrequency}
            options={FOLLOWUP_EMAILS_OPTIONS} />
        </FieldSet>
      </div>}
      <Button onClick={this.handleClick} style={buttonStyle} isRound={true} type="validation">
        {isFirstTime ? 'Valider' : 'Enregistrer'}
      </Button>
    </div>
  }
}
const GoalsSelectionEditor = connect(({user}: RootState): GoalsSelectionEditorConnectedProps => ({
  coachingEmailFrequency: user.profile.coachingEmailFrequency || 'EMAIL_NONE',
}))(GoalsSelectionEditorBase)


interface GoalsSelectionModalProps extends Omit<ModalConfig, 'children'> {
  dispatch: DispatchAllActions
  goals: StrategyGoal[]
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


interface GoalsSelectionPageProps extends GoalsSelectionEditorConfig {
  backUrl: string
  userYou: YouChooser
}


class GoalsSelectionPage
  extends React.PureComponent<GoalsSelectionPageProps, {isSubmitted: boolean}> {
  public static propTypes = {
    backUrl: PropTypes.string.isRequired,
    isFirstTime: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isSubmitted: false,
  }

  private handleSubmit = (reachedGoals): void => {
    this.props.onSubmit(reachedGoals)
    this.setState({isSubmitted: true})
  }

  public render(): React.ReactNode {
    const {backUrl, isFirstTime, onSubmit: omittedOnSubmit, userYou, ...otherProps} = this.props
    if (this.state.isSubmitted) {
      return <Redirect to={backUrl} />
    }
    const headerStyle: React.CSSProperties = {
      fontSize: 13,
      fontWeight: 'bold',
      marginBottom: 35,
      textAlign: 'center',
      textTransform: 'uppercase',
    }
    return <PageWithNavigationBar
      page="strategie" isLogoShown={true} onBackClick={backUrl} style={{backgroundColor: '#fff'}}>
      <header style={headerStyle}>
        <GoalsSelectionTitle {...{isFirstTime, userYou}} />
      </header>
      <GoalsSelectionEditor
        {...otherProps} {...{isFirstTime, userYou}} onSubmit={this.handleSubmit} />
    </PageWithNavigationBar>
  }
}


interface StrategyPageConnectedProps {
  openedStrategy: bayes.bob.WorkingStrategy
  userYou: YouChooser
}


interface StrategyPageParams {
  adviceId?: string
  strategyOrAdvice?: string
}


interface StrategyPageConfig extends RouteComponentProps<StrategyPageParams> {
  baseUrl: string
  project: bayes.bob.Project
  strategy: bayes.bob.Strategy
  strategyRank: number
}


interface StrategyPageProps
  extends StrategyPageConnectedProps, StrategyPageConfig {
  dispatch: DispatchAllActions
}


interface StrategyPageState {
  isGoalsSectionHovered: boolean
  isGoalsSelectionModalShown: boolean
}


class StrategyPageBase extends React.PureComponent<StrategyPageProps, StrategyPageState> {
  public static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
    // TODO(pascal): Fix this after getting out of the workbench.
    match: ReactRouterPropTypes.match.isRequired,
    openedStrategy: PropTypes.shape({
      reachedGoals: PropTypes.objectOf(PropTypes.bool),
      startedAt: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      advices: PropTypes.array.isRequired,
    }).isRequired,
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

  public state = {
    isGoalsSectionHovered: false,
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

  private handleEngagement = (): void => this.setState({isGoalsSelectionModalShown: true})

  private handleGoalsSelection = (reachedGoals): void => {
    const {dispatch, project, openedStrategy, strategy: {strategyId}, strategyRank} = this.props
    const {startedAt} = openedStrategy
    const workingStrategy = {
      reachedGoals,
      startedAt,
      strategyId,
    }
    if (!startedAt) {
      dispatch(startStrategy(project, workingStrategy, strategyRank))
    }
    if (!_isEqual(openedStrategy, workingStrategy)) {
      dispatch(replaceStrategy(project, workingStrategy))
    }
    this.hideGoalsSelectionModal()
    window.scrollTo({behavior: 'smooth', top: 0})
  }

  private hideGoalsSelectionModal = (): void => {
    this.setState({isGoalsSelectionModalShown: false})
  }

  private handleGoalsSectionHover = _memoize(
    (isGoalsSectionHovered): (() => void) => (): void => this.setState({isGoalsSectionHovered}))

  // TODO(cyrille): Drop, since unused.
  private renderBreadCrumbs(style: React.CSSProperties): React.ReactNode {
    const {baseUrl} = this.props
    const containerStyle: React.CSSProperties = {
      padding: 8,
      position: 'relative',
      ...style,
    }
    const backButtonStyle: React.CSSProperties = {
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      boxShadow: 'initial',
      color: colors.DARK_TWO,
      fontSize: 14,
      fontWeight: 'bold',
      left: 8,
      padding: '8px 15px',
      position: 'absolute',
      top: 8,
    }
    const chevronStyle: React.CSSProperties = {
      fill: colors.DARK_TWO,
      margin: '-6px 5px -6px -8px',
      verticalAlign: 'middle',
    }
    return <div style={containerStyle}>
      <Link to={baseUrl}>
        <Button type="discreet" style={backButtonStyle}>
          <ChevronLeftIcon style={chevronStyle} />
          Retour au diagnostic
        </Button>
      </Link>
    </div>
  }

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
      <Link to={this.props.baseUrl} style={linkStyle}>
        <ArrowLeftIcon size={24} style={{marginRight: 25}} />Diagnostic
      </Link>
    </div>
  }

  private renderProgress(progress: number, startedAt: string): React.ReactNode {
    // TODO(cyrille): Find a way to put it back on mobile.
    if (isMobileVersion) {
      return null
    }
    const scoreStyle: React.CSSProperties = {
      fontSize: 13,
      fontWeight: 'bold',
      marginBottom: 7,
    }
    const percentStyle: React.CSSProperties = {
      display: 'inline-block',
      marginRight: 13,
      verticalAlign: 'middle',
      width: 150,
    }
    const dateStyle: React.CSSProperties = {
      color: colors.COOL_GREY,
      fontSize: 10,
      fontStyle: 'italic',
    }
    return <div style={{textAlign: 'center'}}>
      <div style={scoreStyle}>
        <PercentBar
          isPercentShown={false} percent={progress} height={5} color={colorFromPercent(progress)}
          style={percentStyle} />
        {Math.round(progress)}%
      </div>
      <div style={dateStyle}>commencé le {getDateString(startedAt)}</div>
    </div>
  }

  private renderContent = (): React.ReactNode => {
    const {
      baseUrl,
      dispatch,
      openedStrategy: {reachedGoals = {}, startedAt},
      project,
      strategy: {piecesOfAdvice = [], strategyId, title},
      userYou,
    } = this.props
    const {isGoalsSelectionModalShown} = this.state
    const {advices = []} = project
    const titleStyle = {
      margin: '30px auto 50px',
      maxWidth: 600,
    }
    const advicesById = _keyBy(advices, 'adviceId')
    const adviceStyle = startedAt ?
      (index): React.CSSProperties => ({
        borderTop: index && isMobileVersion ? `1px solid ${colors.MODAL_PROJECT_GREY}` : 'none',
        marginTop: index ? 60 : 25,
        paddingTop: index && isMobileVersion ? 30 : 0,
      }) :
      (): React.CSSProperties => ({
        borderBottom: `1px solid ${colors.MODAL_PROJECT_GREY}`,
        padding: '35px 0',
      })
    const modifyPositionStyle: React.CSSProperties = isMobileVersion ? {
      display: 'inline-block',
      marginTop: 15,
    } : {
      position: 'absolute',
      right: 0,
      top: 80,
    }
    const modifyGoalsStyle: React.CSSProperties = {
      backgroundColor: isMobileVersion ? colors.MODAL_PROJECT_GREY : colors.BOB_BLUE,
      border: 'solid 3px #fff',
      borderRadius: 10,
      color: isMobileVersion ? 'inherit' : '#fff',
      cursor: 'pointer',
      fontSize: 13,
      fontStyle: isMobileVersion ? 'normal' : 'italic',
      opacity: isMobileVersion || this.state.isGoalsSectionHovered ? 1 : 0,
      padding: isMobileVersion ? '5px 15px' : '2px 10px',
      ...modifyPositionStyle,
      ...SmoothTransitions,
    }
    const goalsSectionStyle: React.CSSProperties = isMobileVersion ? {
      paddingBottom: 45,
    } : {
      position: 'relative',
    }
    const Method = startedAt ? WorkingMethod : ObservationMethod
    const goals = getStrategiesGoals(userYou)[strategyId] || []
    const objectivesPicto =
      startedAt ? this.renderProgress(getStrategyProgress(goals, reachedGoals), startedAt) : '🎯'
    const testimonials = getStrategiesTestimonials(userYou)[strategyId] || []
    const testimonialStyle = {
      borderTop: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    }
    return <PageWithNavigationBar
      page="strategie" navBarContent={this.renderNavBarContent()} isLogoShown={isMobileVersion}
      onBackClick={baseUrl} style={{backgroundColor: '#fff'}}>
      <div style={{margin: '0 auto', maxWidth: 960, padding: 20}}>
        {startedAt || isGoalsSelectionModalShown ? null :
          <FastForward onForward={this.handleEngagement} />}
        <GoalsSelectionModal
          goals={goals} isFirstTime={!startedAt} userYou={userYou} reachedGoals={reachedGoals}
          onSubmit={this.handleGoalsSelection} isShown={isGoalsSelectionModalShown}
          onClose={this.hideGoalsSelectionModal} dispatch={dispatch} />
        {isMobileVersion ? null : <h1 style={titleStyle}>{title}</h1>}
        <StrategySection
          onMouseOver={this.handleGoalsSectionHover(true)}
          onMouseLeave={this.handleGoalsSectionHover(false)}
          title="Objectifs" picto={objectivesPicto} style={goalsSectionStyle}>
          <StrategyGoalsList goals={goals} reachedGoals={reachedGoals} style={{marginTop: 25}} />
          {startedAt ?
            <div style={{textAlign: 'center'}}>
              <div style={modifyGoalsStyle} onClick={this.handleEngagement}>Modifier</div>
            </div> : null}
        </StrategySection>
        <StrategySection title="Méthodes" picto={startedAt ? null : '📚'}>
          {piecesOfAdvice.filter(({adviceId}): boolean => !!advicesById[adviceId]).
            map(({adviceId, teaser}, index): React.ReactNode => <Method
              key={adviceId} style={adviceStyle(index)} title={teaser} strategyId={strategyId}
              project={project} advice={advicesById[adviceId]} userYou={userYou} />)}
        </StrategySection>
        {testimonials.length && !startedAt ?
          <StrategySection title="Retours d'expérience" picto="💬">
            {testimonials.map((testimonial, index): React.ReactNode => <StrategyTestimonial
              key={`testimonial-${index}`} {...testimonial}
              style={index ? testimonialStyle : {}} />)}
          </StrategySection> : null}
      </div>
      {startedAt ? null :
        <StartBanner baseUrl={baseUrl} userYou={userYou} onStart={this.handleEngagement} />}
    </PageWithNavigationBar>
  }

  private renderGoalEditor = (pageUrl: string): React.ReactNode => {
    const {
      openedStrategy: {reachedGoals = {}, startedAt},
      strategy: {strategyId},
      userYou,
    } = this.props
    const goals = getStrategiesGoals(userYou)[strategyId] || []
    return <GoalsSelectionPage
      goals={goals} isFirstTime={!startedAt} userYou={userYou} reachedGoals={reachedGoals}
      backUrl={pageUrl} onSubmit={this.handleGoalsSelection} />
  }

  public render(): React.ReactNode {
    const {baseUrl, match: {params: {strategyOrAdvice}}} = this.props
    const pageUrl = `${baseUrl}/${strategyOrAdvice}`
    if (this.props.match.params.adviceId === 'objectifs') {
      return this.renderGoalEditor(pageUrl)
    }
    if (isMobileVersion && this.state.isGoalsSelectionModalShown) {
      return <Redirect to={`${pageUrl}/objectifs`} />
    }
    return this.renderContent()
  }
}
const StrategyPage = connect(
  (
    {user}: RootState,
    {project = {}, strategy = {}}: StrategyPageConfig,
  ): StrategyPageConnectedProps => ({
    openedStrategy: getStrategy(project, strategy.strategyId),
    userYou: youForUser(user),
  }))(StrategyPageBase)


interface TestimonialProps {
  content: string
  createdAt: string
  isMale?: boolean
  job: string
  name: string
  rating: number
  style?: React.CSSProperties
}


class StrategyTestimonial extends React.PureComponent<TestimonialProps> {
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
            <span style={{color: colors.COOL_GREY, width: 4}}>•</span>
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
