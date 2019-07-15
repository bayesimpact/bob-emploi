import _fromPairs from 'lodash/fromPairs'
import _isEqual from 'lodash/isEqual'
import _keyBy from 'lodash/keyBy'
import _memoize from 'lodash/memoize'
import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import CheckCircleIcon from 'mdi-react/CheckCircleIcon'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import StarIcon from 'mdi-react/StarIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Link, Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'
import {Swipeable} from 'react-swipeable'

import {DispatchAllActions, RootState, displayToasterMessage, FINISH_PROFILE_SETTINGS,
  setUserProfile, startStrategy, replaceStrategy, strategyWorkPageIsShown,
  strategyExplorationPageIsShown} from 'store/actions'
import {getAdviceGoal} from 'store/advice'
import {StrategyGoal, StrategyTestimonial, YouChooser, genderize, getDateString,
  getDiffBetweenDatesInString, getStrategyGoals, getStrategiesTestimonials,
  upperFirstLetter} from 'store/french'
import {impactFromPercentDelta} from 'store/score'
import {StrategyCompletion, getStartedStrategy, getStrategyCompletion,
  getStrategyProgress} from 'store/strategy'
import {isLateSignupEnabled, youForUser} from 'store/user'

import {AdvicePicto, WorkingMethod} from 'components/advisor'
import {FastForward} from 'components/fast_forward'
import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {SignUpBanner} from 'components/pages/signup'
import {CheckboxList} from 'components/pages/connected/form_utils'
import {AppearingList, BobScoreCircle, Button, FastTransitions, GrowingNumber, LabeledToggle,
  Markdown, PercentBar, PieChart, SmoothTransitions, UpDownIcon,
  colorToAlpha} from 'components/theme'
import bobHeadImage from 'images/bob-head.svg'
import manImage from 'images/man-icon.svg'
import womanImage from 'images/woman-icon.svg'

import {BobModal} from './speech'

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

const METHODS_PER_ROW = 2

const makeStartStrategyOptions = (eFeminine: string = ''):
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


class StrategyProgress extends
  React.PureComponent<Partial<StrategyCompletion> & {style?: React.CSSProperties}> {
  public render(): React.ReactNode {
    const {isComplete, isStarted, progress, style} = this.props
    const percentWidth = isMobileVersion ? {} : {width: 100}
    if (!isStarted) {
      return null
    }
    if (isComplete) {
      const completedStrategyStyle = {
        fill: colors.GREENISH_TEAL,
        ...style,
      }
      return <CheckCircleIcon size={30} style={completedStrategyStyle} />
    }
    const percentStyle = {
      marginRight: 10,
      ...percentWidth,
      ...style,
    }
    return <PercentBar percent={progress} color={colors.DARK_TWO} height={6} style={percentStyle} />
  }
}


interface ListItemProps {
  chevronSize: number
  pageUrl: string
  score?: number
  strategy: bayes.bob.Strategy
  strategyCompletion?: StrategyCompletion
  style?: React.CSSProperties
}

class StrategyListItem extends React.PureComponent<ListItemProps, {isHovered: boolean}> {
  public static propTypes = {
    chevronSize: PropTypes.number.isRequired,
    pageUrl: PropTypes.string.isRequired,
    strategy: PropTypes.shape({
      score: PropTypes.number,
      title: PropTypes.string.isRequired,
    }).isRequired,
    strategyCompletion: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  public static defaultProps = {
    chevronSize: 24,
  }

  public state = {
    isHovered: false,
  }

  private handleSetHovered = _memoize((isHovered): (() => void) =>
    (): void => this.setState({isHovered}))

  private handleClickWhy = (event): void => {
    event.preventDefault()
    event.stopPropagation()
  }

  public render(): React.ReactNode {
    const {chevronSize, pageUrl, strategy, strategy: {score, title},
      strategyCompletion, strategyCompletion: {isComplete}, style} = this.props
    const {isHovered} = this.state
    const scoreStyle: React.CSSProperties = {
      color: impactFromPercentDelta(score).color,
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
      opacity: isHovered ? 1 : 0,
      ...SmoothTransitions,
    }
    return <Link
      onMouseOver={this.handleSetHovered(true)} onMouseLeave={this.handleSetHovered(false)}
      style={containerStyle} to={pageUrl}>
      <div style={{alignItems: 'center', display: 'flex'}}>
        <div style={titleContainerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          {isMobileVersion ? isComplete ? <StrategyProgress {...strategyCompletion} /> : null :
            <div style={{alignItems: 'center', display: 'flex', marginTop: 5}}>
              <h2 style={{...scoreStyle, flexShrink: 0, marginRight: 10}}>+{score}%</h2>
              <WhyButton strategy={strategy} style={whyStyle} onClick={this.handleClickWhy} />
            </div>}
        </div>
        {isMobileVersion ? null :
          <StrategyProgress style={{marginRight: 10}} {...strategyCompletion} />}
        <ChevronRightIcon color={colors.SLATE} size={chevronSize} style={chevronStyle} />
      </div>
      {isMobileVersion && !isComplete ?
        <StrategyProgress style={{marginRight: 10}} {...strategyCompletion} /> : null}
    </Link>
  }
}


interface StrategiesProps {
  makeStrategyLink: (strategyId: string) => string
  project: bayes.bob.Project
  strategies: readonly bayes.bob.Strategy[]
  strategyStyle?: React.CSSProperties
}


class Strategies extends React.PureComponent<StrategiesProps> {
  public static propTypes = {
    makeStrategyLink: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    strategies: PropTypes.arrayOf(PropTypes.shape({
      score: PropTypes.number,
      strategyId: PropTypes.string,
      title: PropTypes.string,
    })).isRequired,
    strategyStyle: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {makeStrategyLink, project, strategies, strategyStyle} = this.props
    const combinedStrategyStyle = {
      alignSelf: 'stretch',
      marginBottom: 20,
      ...strategyStyle,
    }
    return <React.Fragment>
      {strategies.map((strategy, index): React.ReactNode => <StrategyListItem
        key={index} style={combinedStrategyStyle} strategy={strategy}
        strategyCompletion={getStrategyCompletion(project, strategy.strategyId)}
        pageUrl={makeStrategyLink(strategy.strategyId)} />)}
    </React.Fragment>
  }
}


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

  private renderInvisibleChildren(): React.ReactNode[] {
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

const strategyCardStyle: React.CSSProperties = {
  border: `2px solid ${colors.MODAL_PROJECT_GREY}`,
  borderRadius: 20,
  padding: '15px 20px',
}

class StrategySection extends React.PureComponent<Omit<StratPanelProps, 'ref'>> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    style: PropTypes.object,
    title: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {children, style, title, ...otherProps} = this.props
    const sectionStyle = {
      margin: '0 auto 60px',
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
  onSubmit: (reachedGoals: {[goalId: string]: boolean}) => void
  reachedGoals: {[goalId: string]: boolean}
}


interface GoalsSelectionEditorState {
  reachedGoals?: {[goalId: string]: boolean}
  selectedGoals?: string[]
}


class GoalsSelectionEditor
  extends React.PureComponent<GoalsSelectionEditorProps, GoalsSelectionEditorState> {
  public static propTypes = {
    goals: PropTypes.array.isRequired,
    isFirstTime: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    reachedGoals: PropTypes.objectOf(PropTypes.bool).isRequired,
  }

  public state: GoalsSelectionEditorState = {
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

  private handleClick = (): void => {
    const {goals, onSubmit} = this.props
    const selectedGoalsSet = new Set(this.state.selectedGoals)
    const reachedGoals =
      _fromPairs(goals.map(({goalId}): [string, boolean] => [goalId, selectedGoalsSet.has(goalId)]))
    onSubmit(reachedGoals)
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
    return <div style={containerStyle}>
      <FastForward onForward={this.onForward} />
      <CheckboxList
        onChange={this.handleGoalsChange} options={options} values={this.state.selectedGoals}
        checkboxStyle={{marginBottom: 10}} />
      <Button onClick={this.handleClick} style={buttonStyle} isRound={true} type="validation">
        {isFirstTime ? 'Valider' : 'Enregistrer'}
      </Button>
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


interface GoalsSelectionPageProps extends GoalsSelectionEditorProps {
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
      marginTop: 35,
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


interface MethodProps {
  advice: bayes.bob.Advice
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
          startColor={colors.BOB_BLUE} color={colors.BOB_BLUE} />
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
    const {name} = FOLLOWUP_EMAILS_OPTIONS.find(({value}): boolean => value === frequency)
    return <div onClick={onClick} style={containerStyle}>
      <div style={{flex: 1}}>
        <div style={headerStyle}>Type de coaching&nbsp;:</div>
        <div style={nameStyle}>{name}</div>
      </div>
      <ChevronDownIcon size={24} />
    </div>
  }
}
const SelectCoaching = connect(({user: {profile: {coachingEmailFrequency: frequency}}}: RootState):
SelectedCoachingConnectedProps => ({frequency}))(Radium(SelectCoachingBase))

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
    return <div onClick={isDisabled ? null : onClick} style={optionStyle}>
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
}

interface CoachingModalProps extends Omit<ModalConfig, 'children'>, CoachingModalConnectedProps {
  dispatch: DispatchAllActions
  userYou: YouChooser
}

interface CoachingModalState {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  isActive?: boolean
  isShown?: boolean
}

// TODO(cyrille): Make it a full-page on mobile.
class CoachingModalBase
  extends React.PureComponent<CoachingModalProps, CoachingModalState> {
  public state: CoachingModalState = {}

  public static getDerivedStateFromProps(
    {coachingEmailFrequency, isShown}: CoachingModalProps,
    {isShown: wasShown}: CoachingModalState): CoachingModalState {
    if (!isShown === !wasShown) {
      return null
    }
    return {
      ...isShown && {
        coachingEmailFrequency,
        isActive: true,
      },
      isShown,
    }
  }

  private handleToggleActive = (): void => this.setState(({isActive}): CoachingModalState => ({
    coachingEmailFrequency: isActive ? 'EMAIL_NONE' : undefined,
    isActive: !isActive,
  }))

  private handleClickOption = _memoize((coachingEmailFrequency): (() => void) => (): void =>
    this.setState({coachingEmailFrequency}))

  private handleConfirm = (): void => {
    const {dispatch, onClose} = this.props
    const {coachingEmailFrequency} = this.state
    // TODO(cyrille): Change action to something specific remembering the strategy.
    dispatch(setUserProfile({coachingEmailFrequency}, true, FINISH_PROFILE_SETTINGS)).
      then((success): void => {
        if (success) {
          onClose && onClose()
          dispatch(displayToasterMessage('Modifications sauvegardées.'))
        }
      })
  }

  public render(): React.ReactNode {
    const {gender, isShown, onClose, userYou} = this.props
    const {coachingEmailFrequency, isActive} = this.state
    const contentStyle = {
      padding: isMobileVersion ? 30 : '30px 50px 50px',
    }
    const buttonsStyle = {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 40,
    }
    return <Modal
      isShown={isShown} onClose={onClose} style={{margin: 20}}
      title={`Choisis${userYou('', 'sez')} le coaching qui ${userYou('te', 'vous')} convient`}>
      <div style={contentStyle}>
        <LabeledToggle
          onClick={this.handleToggleActive} type="swipe" style={{marginBottom: 20}}
          label={`Coaching ${isActive ? '' : 'des'}activé`} isSelected={isActive} />
        {FOLLOWUP_EMAILS_OPTIONS.map(({description, value, ...option}): React.ReactNode =>
          <CoachingOption
            {...option} isSelected={coachingEmailFrequency === value} isDisabled={!isActive}
            description={description(userYou, genderize('·e', 'e', '', gender))}
            onClick={this.handleClickOption(value)}
            key={value} style={{marginBottom: 20}} />)}
        <div style={buttonsStyle}>
          <Button isRound={true} type="back" style={{marginRight: 15}} onClick={onClose}>
            Annuler
          </Button>
          <Button isRound={true} disabled={!coachingEmailFrequency} onClick={this.handleConfirm}>
            Continuer
          </Button>
        </div>
      </div>
    </Modal>
  }
}
const CoachingModal = connect(({user: {profile: {coachingEmailFrequency, gender} = {}}}: RootState):
CoachingModalConnectedProps => ({
  coachingEmailFrequency,
  gender,
}))(CoachingModalBase)


interface GoalsPanelProps {
  coachingEmailFrequency?: bayes.bob.EmailFrequency
  handleEngagement: () => void
  openedStrategy: bayes.bob.WorkingStrategy
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
      <CoachingModal
        userYou={userYou} isShown={isCoachingModalShown}
        onClose={this.handleShowCoachingModal(false)} />
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


interface StrategyPageConnectedProps {
  isGuest: boolean
  openedStrategy: bayes.bob.WorkingStrategy
  profile: bayes.bob.UserProfile
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
  areAllMethodsShown: boolean
  isEngagementModalShown: boolean
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
    profile: PropTypes.shape({
      coachingEmailFrequency: PropTypes.string,
      email: PropTypes.string,
      gender: PropTypes.string,
    }),
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

  private handleEngagement = (): void => this.setState({
    isEngagementModalShown: false,
    isGoalsSelectionModalShown: true,
  })

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

  private handleShowAllMethods = (): void => this.setState({areAllMethodsShown: true})

  private handleShowEngagementModal = _memoize((isEngagementModalShown): (() => void) => (): void =>
    this.setState({isEngagementModalShown}))

  private handleCloseCoachingRegistrationModal = (): void => {
    const {dispatch} = this.props
    dispatch(setUserProfile(
      {coachingEmailFrequency: undefined}, true, FINISH_PROFILE_SETTINGS)).
      then((): void => {
        dispatch(displayToasterMessage('Le coaching a été annulé'))
      })
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

  private renderMobileObservation = (
    methods: [bayes.bob.Advice, string][],
    goals: readonly StrategyGoal[],
    testimonials: StrategyTestimonial[]): React.ReactNode => {
    const {baseUrl, profile: {gender}, strategy: {score}, userYou} = this.props
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
      page="strategie" onBackClick={baseUrl} isLogoShown={true}
      style={{backgroundColor: '#fff', padding: '25px 15px 50px'}}
      navBarContent={this.renderNavBarContent()}>
      <Modal
        title="Avant de me lancer" isShown={this.state.isEngagementModalShown}
        style={{margin: '0 20px'}} onClose={this.handleShowEngagementModal(false)}>
        <EngagementContent
          style={modalContentStyle} gender={gender} handleEngagement={this.handleEngagement} />
      </Modal>
      <ScorePanel score={score} style={{marginBottom: 35}} />
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
  private renderContent = (): React.ReactNode => {
    const {
      baseUrl,
      dispatch,
      isGuest,
      openedStrategy, openedStrategy: {reachedGoals = {}, startedAt},
      profile: {coachingEmailFrequency, email, gender},
      project, project: {advices = []},
      strategy, strategy: {piecesOfAdvice = [], score, strategyId, title},
      userYou,
    } = this.props
    const advicesById = _keyBy(advices, 'adviceId')
    const strategyMethods = piecesOfAdvice.filter(({adviceId}): boolean => !!advicesById[adviceId]).
      map(({adviceId, teaser}): [bayes.bob.Advice, string] => [advicesById[adviceId], teaser])
    const goals = getStrategyGoals(userYou, strategyId)
    const testimonials = getStrategiesTestimonials(userYou)[strategyId] || []
    if (isMobileVersion && !startedAt) {
      return this.renderMobileObservation(strategyMethods, goals, testimonials)
    }
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
      Math.ceil(strategyMethods.length / METHODS_PER_ROW) - 1 : 0
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
    const coachingRegistrationModalContentStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      padding: '30px 50px 50px',
    }
    return <PageWithNavigationBar
      page="strategie" navBarContent={this.renderNavBarContent()} isLogoShown={isMobileVersion}
      onBackClick={baseUrl} style={{backgroundColor: '#fff'}}>
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
      {isGuest && !email ? <Modal
        style={{margin: 20, maxWidth: 500}}
        isShown={!!coachingEmailFrequency && coachingEmailFrequency !== 'EMAIL_NONE'}
        onClose={this.handleCloseCoachingRegistrationModal} title="Un compte est nécessaire">
        <div style={coachingRegistrationModalContentStyle}>
          Pour {userYou('te', 'vous')} coacher, j'ai besoin de {userYou('ton', 'votre')} adresse
          email. Crée{userYou(' ton', 'z votre')} compte pour activer le coaching 🙂
          <LoginButton
            type="navigation" visualElement="coaching"
            style={{display: 'block', marginTop: 30}} isRound={true}>
            Créer mon compte maintenant
          </LoginButton>
        </div>
      </Modal> : null}
      <div style={contentStyle}>
        <div>
          {/* TODO(cyrille): Replace the goals panel on mobile by new mobile UI. */}
          {startedAt ? isMobileVersion ? <GoalsPanel
            userYou={userYou} handleEngagement={this.handleEngagement} style={{marginBottom: 20}}
            openedStrategy={openedStrategy} /> : null : <StrategySection
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
              {strategyMethods.map(([advice, teaser], index): React.ReactNode => <WorkingMethod
                key={advice.adviceId} style={adviceStyle(index)} title={teaser}
                {...{advice, project, strategyId, userYou}} />)}
            </StrategySection> : null}
        </div>
        {isMobileVersion ? null : startedAt ?
          <GoalsPanel
            userYou={userYou} style={{flex: 'none', width: RIGHT_PANEL_WIDTH}}
            handleEngagement={this.handleEngagement} openedStrategy={openedStrategy} /> :
          <div style={{width: RIGHT_PANEL_WIDTH}}>
            <ScorePanel score={score} style={{marginBottom: 40}} />
            <StratPanel title="Sujets à travailler">
              <AppearingList
                maxNumChildren={areAllMethodsShown ? 0 : METHODS_PER_ROW} style={methodsListStyle}>
                {strategyMethods.map(([advice], index): ReactStylableElement =>
                  <ObservationMethod
                    key={advice.adviceId} {...{advice, userYou}} style={methodStyle(index)} />)}
              </AppearingList>
              {areAllMethodsShown || strategyMethods.length <= METHODS_PER_ROW ? null :
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

  private renderGoalEditor = (pageUrl: string): React.ReactNode => {
    const {
      openedStrategy: {reachedGoals = {}, startedAt},
      strategy: {strategyId},
      userYou,
    } = this.props
    const goals = getStrategyGoals(userYou, strategyId)
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
    {user, user: {hasAccount, profile}}: RootState,
    {project = {}, strategy: {strategyId} = {}}: StrategyPageConfig,
  ): StrategyPageConnectedProps => ({
    isGuest: isLateSignupEnabled && !hasAccount,
    openedStrategy: getStartedStrategy(project, strategyId),
    profile,
    userYou: youForUser(user),
  }))(StrategyPageBase)


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
