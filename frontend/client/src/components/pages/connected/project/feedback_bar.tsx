import _max from 'lodash/max'
import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, sendProjectFeedback} from 'store/actions'
import {getAdviceShortTitle} from 'store/advice'
import {YouChooser} from 'store/french'
import {youForUser} from 'store/user'

import starIcon from 'images/star.svg'
import whiteStarIcon from 'images/star-white.svg'
// eslint-disable-next-line import/no-duplicates
import starOutlineIcon from 'images/star-outline.svg'
// eslint-disable-next-line import/no-duplicates
import greyStarOutlineIcon from 'images/star-outline.svg?stroke=#9596a0'
import {isMobileVersion} from 'components/mobile'
import {Modal} from 'components/modal'
import {ShareModal} from 'components/share'
import {Button, SmoothTransitions, Textarea} from 'components/theme'
import {FEEDBACK_TAB} from 'components/url'
import {CheckboxList} from 'components/pages/connected/form_utils'

const feedbackTitle = {
  '1': 'Vraiment inutile',
  '2': 'Peu intéressant',
  '3': 'Intéressant',
  '4': 'Pertinent',
  '5': 'Très pertinent',
}


// Add a delay after a given date.
const addDuration = (time: string, delayMillisec: number): Date | undefined => {
  if (!time) {
    return undefined
  }
  return new Date(new Date(time).getTime() + delayMillisec)
}


// Get the date and time at which to show the request feedback.
const getRequestFeedbackShowDate = (
  {app: {submetricsExpansion = {}}, user: {featuresEnabled: {stratTwo}}}: RootState,
  {advices, diagnosticShownAt, feedback, openedStrategies = [], strategies}: bayes.bob.Project
): Date | undefined => {
  // Feedback already given.
  if (feedback && feedback.score) {
    return undefined
  }

  // User is in pre-strat UX.
  if (stratTwo !== 'ACTIVE' || !strategies.length) {
    // The user started interacting with the pre-strat content.
    if (advices.some(({status}): boolean => status === 'ADVICE_READ') ||
      !!Object.keys(submetricsExpansion).length) {
      return new Date()
    }

    // Wait for 13s in diagnostic even if they do not open an advice page.
    return addDuration(diagnosticShownAt, 13000)
  }

  // User has started a strategy: wait for 20s.
  const lastStratStarted = _max(openedStrategies.map(({startedAt}): string => startedAt))
  if (lastStratStarted) {
    return addDuration(lastStratStarted, 20000)
  }

  // User has seen the diagnostic but has not started a strategy: wait 60s.
  return addDuration(diagnosticShownAt, 60000)
}


interface FormProps {
  dispatch: DispatchAllActions
  isFeminine: boolean
  onSubmit?: () => void
  project: bayes.bob.Project
  score?: number
  userYou: YouChooser
}


interface BarConnectedProps {
  isFeminine: boolean
  userYou: YouChooser
}


interface BarConfig {
  children?: never
  evaluationUrl: string
  isShown: boolean
  onSubmit?: () => void
  project: bayes.bob.Project
}


interface BarProps extends BarConnectedProps, BarConfig {
  dispatch: DispatchAllActions
}


interface BarState {
  isModalShown: boolean
  score: number
}


class FeedbackBarBase extends React.PureComponent<BarProps, BarState> {
  public static propTypes = {
    evaluationUrl: PropTypes.string.isRequired,
    isShown: PropTypes.bool.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isModalShown: false,
    score: 0,
  }

  private form: React.RefObject<FeedbackForm> = React.createRef()

  private openModal = (score: number): void => {
    if (this.form.current) {
      this.form.current.setState({score})
    }
    this.setState({isModalShown: true, score})
  }

  private handleCancel = (): void => this.setState({isModalShown: false, score: 0})

  private renderModal(): React.ReactNode {
    const {isModalShown, score} = this.state
    const {evaluationUrl} = this.props
    if (isMobileVersion) {
      if (isModalShown) {
        return <Redirect to={`${evaluationUrl}/${score}`} push={true} />
      }
      return null
    }
    return <Modal
      isShown={isModalShown} style={{margin: '0 10px'}}
      onClose={this.handleCancel}>
      <FeedbackForm {...this.props} ref={this.form} score={score} />
    </Modal>
  }

  public render(): React.ReactNode {
    const {isShown, project: {feedback}, userYou} = this.props
    const {score} = this.state
    if (feedback && feedback.score) {
      return null
    }
    const hideBelowStyle: React.CSSProperties = {
      transform: isShown ? 'initial' : 'translateY(calc(100% + 10px))',
      ...SmoothTransitions,
    }
    const fixedBottomStyle: React.CSSProperties = {
      bottom: 0,
      left: 0,
      pointerEvents: 'none',
      position: 'fixed',
      right: 0,
      zIndex: 1,
      ...hideBelowStyle,
    }
    const containerStyle: React.CSSProperties = {
      // TODO(cyrille): Change colors for background, text and stars for a better contrast.
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: 5,
      boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      color: '#fff',
      margin: '0 auto 10px',
      padding: '10px 10px 5px',
      pointerEvents: 'initial',
      position: 'relative',
      width: 310,
      ...isMobileVersion ? hideBelowStyle : {},
    }
    return <React.Fragment>
      {this.renderModal()}
      <div style={isMobileVersion ? {overflow: 'hidden'} : fixedBottomStyle}>
        <div style={containerStyle}>
          <FeedbackStars
            userYou={userYou} score={score} onStarClick={this.openModal}
            isWhite={true} />
        </div>
      </div>
      {isMobileVersion ? null : <div style={{height: 80}} />}
    </React.Fragment>
  }
}
const FeedbackBar = connect(({user}: RootState): BarConnectedProps => ({
  isFeminine: user.profile.gender === 'FEMININE',
  userYou: youForUser(user),
}))(FeedbackBarBase)


interface PageWithFeedbackConnectedProps {
  showAfter: Date | undefined
  userYou: YouChooser
}


interface PageWithFeedbackConfig
  extends Omit<BarConfig, 'children' | 'evaluationUrl' | 'onSubmit' | 'isShown'> {
  baseUrl: string
  children: React.ReactNode
}


interface PageWithFeedbackProps
  extends PageWithFeedbackConfig,
  RouteComponentProps<{}, {}, {returningFromFeedbackPage?: boolean}>,
  PageWithFeedbackConnectedProps {
  dispatch: DispatchAllActions
}


type PageRouteProps = RouteComponentProps<{score?: string}>


class PageWithFeedbackBase
  extends React.PureComponent<PageWithFeedbackProps, {isShareBobShown: boolean; isShown: boolean}> {
  public static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    dispatch: PropTypes.func.isRequired,
    location: ReactRouterPropTypes.location.isRequired,
    project: PropTypes.object.isRequired,
    showAfter: PropTypes.instanceOf(Date),
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isShareBobShown: false,
    isShown: !!this.props.showAfter && this.props.showAfter < new Date(),
  }

  public componentDidMount(): void {
    this.updateShowAfter(this.props.showAfter)
  }

  public componentDidUpdate(prevProps: PageWithFeedbackProps): void {
    const {
      location: {state: {returningFromFeedbackPage: prevReturning = false} = {}},
      showAfter: prevShowAfter,
    } = prevProps
    const {
      location: {state: {returningFromFeedbackPage = false} = {}},
      showAfter,
    } = this.props
    if (!prevReturning && returningFromFeedbackPage) {
      this.handleReturnFromFeedback()
    }
    if (showAfter !== prevShowAfter) {
      this.updateShowAfter(showAfter)
    }
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout: ReturnType<typeof setTimeout>

  private handleReturnFromFeedback = (): void => {
    const {feedback} = this.props.project
    if (feedback && feedback.score >= 4) {
      this.setState({isShareBobShown: true})
    }
  }

  private hideShareModal = (): void => {
    this.setState({isShareBobShown: false})
  }

  private updateShowAfter(showAfter: Date | undefined): void {
    clearTimeout(this.timeout)
    if (showAfter) {
      const showInMillisec = showAfter.getTime() - new Date().getTime()
      this.timeout = setTimeout((): void => this.setState({isShown: true}), showInMillisec)
    }
  }

  private renderPage = ({match: {params: {score}}}: PageRouteProps): React.ReactNode => {
    const {baseUrl,
      children: omittedChildren, dispatch: omittedDispatch, location: omittedLocation,
      userYou: omittedUserYou,
      ...otherProps} = this.props
    return <FeedbackPage
      {...otherProps} score={score ? parseInt(score, 10) : undefined}
      backTo={{pathname: baseUrl, state: {returningFromFeedbackPage: true}}} />
  }

  public render(): React.ReactNode {
    const {baseUrl, children, dispatch, showAfter: omittedShowAfter, userYou,
      ...barProps} = this.props
    const {isShareBobShown, isShown} = this.state
    const evaluationUrl = `${baseUrl}/${FEEDBACK_TAB}`
    return <Switch>
      <Route path={`${evaluationUrl}/:score?`} render={this.renderPage} />
      <React.Fragment>
        {children}
        <FeedbackBar
          {...barProps} evaluationUrl={evaluationUrl}
          onSubmit={this.handleReturnFromFeedback} isShown={isShown} />
        <ShareModal
          onClose={this.hideShareModal} isShown={isShareBobShown}
          title={userYou('Toi aussi, aide tes amis', 'Vous aussi, aidez vos amis')}
          campaign="fs" visualElement="feedback" dispatch={dispatch}
          intro={<React.Fragment>
            <strong>{userYou('Envoie', 'Envoyez')}-leur directement ce lien <br /></strong>
            et on s'occupe du reste&nbsp;!
          </React.Fragment>} />
      </React.Fragment>
    </Switch>
  }
}
const PageWithFeedback = connect(
  (state: RootState, {project}: PageWithFeedbackConfig): PageWithFeedbackConnectedProps => ({
    showAfter: getRequestFeedbackShowDate(state, project),
    userYou: youForUser(state.user),
  })
)(withRouter(PageWithFeedbackBase))


interface PageProps extends BarConnectedProps, FormProps {
  backTo: string | {pathname: string; state: object}
}


class FeedbackPageBase extends React.PureComponent<PageProps, {isFeedbackSubmitted: boolean}> {
  public state = {
    isFeedbackSubmitted: false,
  }

  private handleSubmit = (): void => this.setState({isFeedbackSubmitted: true})

  public render(): React.ReactNode {
    if (this.state.isFeedbackSubmitted) {
      return <Redirect to={this.props.backTo} />
    }
    return <FeedbackForm {...this.props} onSubmit={this.handleSubmit} />
  }
}
const FeedbackPage = connect(({user}: RootState): BarConnectedProps => ({
  isFeminine: user.profile.gender === 'FEMININE',
  userYou: youForUser(user),
}))(FeedbackPageBase)


interface FormState {
  score?: number
  selectedAdvices?: string[]
  text?: string
}


interface SelectOption {
  name: string
  value: string
}


class FeedbackForm extends React.PureComponent<FormProps, FormState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isFeminine: PropTypes.bool,
    onSubmit: PropTypes.func,
    project: PropTypes.object.isRequired,
    score: PropTypes.number,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    score: this.props.score || 0,
    selectedAdvices: [],
    text: '',
  }

  private saveFeedback = (): void => {
    const {dispatch, onSubmit, project} = this.props
    const {score, text, selectedAdvices} = this.state
    const usefulAdviceModules = {};
    (selectedAdvices || []).forEach((adviceId: string): void => {
      usefulAdviceModules[adviceId] = true
    })
    dispatch(sendProjectFeedback(project, {score, text, usefulAdviceModules}))
    onSubmit && onSubmit()
  }

  private handleUpdateScore = (value: number): void => this.setState({score: value})

  private handleUpdateSelectedAdvices = (value: string[]): void =>
    this.setState({selectedAdvices: value})

  private handleUpdateText = (value: string): void => this.setState({text: value})

  public render(): React.ReactNode {
    const {isFeminine, project: {advices}, userYou} = this.props
    const {score, selectedAdvices, text} = this.state
    const isGoodFeedback = score > 2
    const shownAdvices = advices.filter(({status}): boolean => status === 'ADVICE_READ') || []
    const containerStyle: React.CSSProperties = {
      padding: isMobileVersion ? 20 : 50,
    }
    const contentStyle: React.CSSProperties = {
      fontSize: 15,
      padding: '35px 0',
      position: 'relative',
      width: isMobileVersion ? 'initial' : 600,
    }
    return <div style={containerStyle}>
      <div style={{borderBottom: `solid 2px ${colors.SILVER}`, paddingBottom: 35}}>
        <FeedbackStars
          userYou={userYou} score={score} onStarClick={this.handleUpdateScore}
          size={30} />
      </div>
      <div style={contentStyle}>
        <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
          {isGoodFeedback ? <span>
            Qu'est-ce qui {userYou("t'", 'vous ')}a le plus
            aidé{isFeminine ? 'e' : ''} dans {config.productName}&nbsp;?
          </span> : <span>
            {userYou('Peux-tu', 'Pouvez-vous')} nous dire ce qui n'a pas fonctionné
            pour {userYou('toi', 'vous')}&nbsp;?
          </span>}
        </div>
        <Textarea
          style={{height: 180, padding: 10, width: '100%'}}
          placeholder={`${userYou('Écris ton', 'Écrivez votre')} commentaire ici`}
          value={text} onChange={this.handleUpdateText} />
        {isGoodFeedback ? <div>
          <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
            Y a-t-il des conseils qui {userYou("t'", 'vous ')}ont particulièrement
            intéressé{isFeminine ? 'e' : ''}&nbsp;?
          </div>
          <CheckboxList
            onChange={this.handleUpdateSelectedAdvices} values={selectedAdvices}
            options={(shownAdvices).
              filter((a): boolean => a.numStars > 1).
              map((advice): SelectOption => ({
                name: getAdviceShortTitle(advice, userYou),
                value: advice.adviceId,
              })).
              filter(({name}): boolean => !!name)} />
        </div> : null}
      </div>
      <div style={{textAlign: 'center'}}>
        <Button onClick={this.saveFeedback} isRound={true}>Envoyer</Button>
      </div>
    </div>
  }
}


interface StarsProps {
  // TODO(pascal): Consider removing as it's always true.
  isWhite?: boolean
  onStarClick: (star: number) => void
  score: number
  size: number
  userYou: YouChooser
}


class FeedbackStars extends React.PureComponent<StarsProps, {hoveredStars: number}> {
  public static propTypes = {
    isWhite: PropTypes.bool,
    onStarClick: PropTypes.func.isRequired,
    score: PropTypes.number.isRequired,
    size: PropTypes.number,
    userYou: PropTypes.func.isRequired,
  }

  public static defaultProps = {
    size: 20,
  }

  public state = {
    hoveredStars: 0,
  }

  private handleClickStar = _memoize((numStars: number): (() => void) =>
    (): void => this.props.onStarClick(numStars))

  private renderTitle(numStars: number): React.ReactNode {
    const {userYou} = this.props
    return feedbackTitle[numStars] ||
      `Que pense${userYou('s-tu', 'z-vous')} de ${config.productName}\u00A0?`
  }

  public render(): React.ReactNode {
    const {isWhite, score, size} = this.props
    const {hoveredStars} = this.state
    const highlightedStars = hoveredStars || score || 0
    const starStyle = {
      cursor: 'pointer',
      height: size + 10,
      padding: 5,
    }
    const notOnMobile = (callback: () => void): (() => void) => isMobileVersion ? null : callback
    const fullStar = isWhite ? whiteStarIcon : starIcon
    const emptyStar = isWhite ? starOutlineIcon : greyStarOutlineIcon
    return <div style={{textAlign: 'center'}}>
      <div style={{fontSize: 16, fontWeight: 500, marginBottom: 5}}>
        {this.renderTitle(highlightedStars)}
      </div>
      <div>
        {/* TODO(pascal): Drop the arrow props below. */}
        {new Array(5).fill(null).map((unused, index): React.ReactNode => <img
          onMouseEnter={notOnMobile((): void => this.setState({hoveredStars: index + 1}))}
          onMouseLeave={notOnMobile((): void => {
            if (hoveredStars === index + 1) {
              this.setState({hoveredStars: 0})
            }
          })}
          style={starStyle} alt={`${index + 1} étoile${index ? 's' : ''}`}
          onClick={this.handleClickStar(index + 1)}
          src={(index < highlightedStars) ? fullStar : emptyStar} key={`star-${index}`} />)}
      </div>
    </div>
  }
}


export {PageWithFeedback}
