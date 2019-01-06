import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Redirect, Route, Switch} from 'react-router-dom'

import {diagnosticIsShown, diagnosticTalkIsShown, downloadDiagnosticAsPdf} from 'store/actions'
import {getTopicUrl} from 'store/advice'
import {youForUser} from 'store/user'

import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {ShareModal} from 'components/share'
import {JobGroupCoverImage, CircularProgress, SmoothTransitions} from 'components/theme'
import {FEEDBACK_TAB, NEW_PROJECT_ID, Routes} from 'components/url'

import {Diagnostic} from './project/diagnostic'
import {FeedbackBar, FeedbackPage} from './project/feedback_bar'
import {PoleEmploiChangelogModal} from './project/pole_emploi'
import {Workbench} from './project/workbench'


function getProjectFromProps(props) {
  const {match, user} = props
  const projectId = match.params.projectId || ''
  const project = (user.projects || []).find(project => project.projectId === projectId)
  if (project) {
    return project
  }
  if ((user.projects || []).length) {
    return user.projects[0]
  }
  return {}
}



const TOTAL_WAITING_TIME_MILLISEC = 8000


class WaitingProjectPage extends React.Component {
  static propTypes = {
    fadeOutTransitionDurationMillisec: PropTypes.number.isRequired,
    onDone: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userProfile: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  static defaultProps = {
    fadeOutTransitionDurationMillisec: 600,
  }

  state = {
    isFadingOut: false,
    waitingText: this.getWaitingTexts()[0],
  }

  componentDidMount() {
    this.updateText(0)
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  getWaitingTexts() {
    const {userYou} = this.props
    return [
      `Analyse du marché du travail dans ${userYou('ta', 'votre')} région`,
      `Analyse de ${userYou('ta', 'votre')} situation actuelle`,
      'Évaluation des axes stratégiques prioritaires',
      'Préparation des solutions potentielles',
    ]
  }

  updateText = waitingTextIndex => {
    const {onDone, fadeOutTransitionDurationMillisec} = this.props
    const waitingTexts = this.getWaitingTexts()
    if (waitingTextIndex >= waitingTexts.length) {
      this.setState({isFadingOut: true})
      this.timeout = setTimeout(onDone, fadeOutTransitionDurationMillisec)
      return
    }
    this.setState({waitingText: waitingTexts[waitingTextIndex]})
    this.timeout = setTimeout(
      () => this.updateText(waitingTextIndex + 1),
      TOTAL_WAITING_TIME_MILLISEC / waitingTexts.length)
  }

  render() {
    const {onDone, project, style, userProfile, userYou} = this.props
    const {isFadingOut} = this.state
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 15,
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const boxStyle = {
      backgroundColor: '#fff',
      borderRadius: 10,
      opacity: isFadingOut ? 0 : 1,
      padding: isMobileVersion ? 30 : '50px 100px',
      textAlign: 'center',
      ...SmoothTransitions,
    }
    const headerStyle = {
      color: colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
    }
    const waitingNoticeStyle = {
      color: colors.BOB_BLUE,
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 1.5,
    }
    return <div style={containerStyle}>
      <FastForward onForward={onDone} />
      <JobGroupCoverImage romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}} />
      <div style={boxStyle}>
        <header style={headerStyle}>{project.title}</header>
        <div style={{margin: 'auto', maxWidth: 360, paddingTop: 23}}>
          Merci {userProfile.name} pour {userYou('ta', 'votre')} patience&nbsp;!<br /><br />
          Nous analysons {userYou('tes', 'vos')} informations pour
          créer {userYou('ton', 'votre')} diagnostic personnalisé.
        </div>
        <div style={{padding: 30}}>
          <CircularProgress color={waitingNoticeStyle.color} />
        </div>
        <div style={waitingNoticeStyle}>
          {this.state.waitingText}…
        </div>
      </div>
    </div>
  }
}


class ProjectPageBase extends React.Component {
  static propTypes = {
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        projectId: PropTypes.string,
      }),
    }),
    user: PropTypes.object.isRequired,
  }

  state = {
    isFirstTime: this.props.match.params.projectId === NEW_PROJECT_ID,
    isWaitingInterstitialShown: this.props.match.params.projectId === NEW_PROJECT_ID,
  }

  handleWaitingInterstitialDone = () => {
    this.setState({isWaitingInterstitialShown: false})
  }

  render() {
    const project = getProjectFromProps(this.props)
    const {location, match: {params: {projectId} = {}, url} = {}, user} = this.props
    const {hash, search} = location
    const {isFirstTime, isWaitingInterstitialShown} = this.state

    if (project.projectId && project.projectId !== projectId) {
      return <Redirect to={Routes.PROJECT_PAGE + '/' + project.projectId + hash} />
    }

    if (isWaitingInterstitialShown || (!project.advices && !project.diagnostic)) {
      return <WaitingProjectPage
        userYou={youForUser(user)} userProfile={user.profile}
        style={{flex: 1}} project={project}
        onDone={this.handleWaitingInterstitialDone} />
    }

    return <Switch>
      <Route path={`${url}/:tab?`} render={props => <ProjectDashboardPage
        project={project} baseUrl={url} {...{isFirstTime, ...props}}
        onFirstTimeIsDone={() => this.setState({isFirstTime: false})} />} />
      <Redirect to={`${url}${search}${hash}`} />
    </Switch>
  }
}
export default connect(({user}) => ({user}))(ProjectPageBase)


class ProjectDashboardPage extends React.Component {
  static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    isFirstTime: PropTypes.bool,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        tab: PropTypes.string,
      }).isRequired,
      url: PropTypes.string.isRequired,
    }).isRequired,
    onFirstTimeIsDone: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
  }

  componentDidUpdate() {
    const {
      isFirstTime,
      match: {params: {tab}},
      onFirstTimeIsDone,
    } = this.props

    if (isFirstTime && tab) {
      onFirstTimeIsDone()
    }
  }

  render() {
    const {baseUrl, isFirstTime, location, match: {params: {tab}}, project} = this.props
    const {hash, search} = location

    if (!tab) {
      return <DiagnosticPage
        makeAdviceLink={(adviceId, topic) =>
          `${this.props.baseUrl}/${getTopicUrl(topic)}/${adviceId}`}
        evaluationUrl={`${baseUrl}/${FEEDBACK_TAB}`}
        {... {isFirstTime, project}} />
    }

    if (tab === FEEDBACK_TAB) {
      return <Route
        path={`${baseUrl}/${FEEDBACK_TAB}/:score?`} render={({match: {params: {score}}}) =>
          <FeedbackPage
            project={project} backTo={baseUrl} score={score ? parseInt(score) : undefined} />
        } />
    }

    return <Switch>
      <Route path={`${baseUrl}/:topicOrAdvice/:adviceId?`} render={props =>
        <Workbench
          {...props} baseUrl={baseUrl} project={project} style={{flex: 1}}
          urlOnClose={baseUrl} />} />
      {/* Got an unknown tab, redirect to base URL to switch to default tab. */}
      <Redirect to={`${baseUrl}${search}${hash}`} />
    </Switch>
  }
}


class DiagnosticPageBase extends React.Component {
  static getFeedbackBarState({canShowFeedbackBar}, prevState) {
    // Do not reset to false once set to true. Do not reset if same value.
    if (prevState.canShowFeedbackBar || !canShowFeedbackBar) {
      return null
    }
    return {canShowFeedbackBar: true}
  }

  static getScoreState({project: {feedback: {score = 0} = {}}}, prevState) {
    if (score === prevState.score) {
      return null
    }
    const newState = {score}
    if (score >= 4) {
      newState.isShareBobShown = true
    }
    return newState
  }

  static propTypes = {
    canShowFeedbackBar: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
    evaluationUrl: PropTypes.string.isRequired,
    featuresEnabled: PropTypes.shape({
      poleEmploi: PropTypes.bool,
    }).isRequired,
    isFirstTime: PropTypes.bool,
    makeAdviceLink: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      name: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      advices: PropTypes.array,
      diagnostic: PropTypes.object,
      feedback: PropTypes.shape({
        score: PropTypes.number,
      }),
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    canShowFeedbackBar: false,
    isPoleEmploiChangelogShown: this.props.featuresEnabled.poleEmploi,
    isShareBobShown: false,
    score: 0,
  }

  static getDerivedStateFromProps(props, prevState) {
    const newScore = DiagnosticPageBase.getScoreState(props, prevState)
    const newFeedbackBar = DiagnosticPageBase.getFeedbackBarState(props, prevState)
    if (newFeedbackBar || newScore) {
      return {...newFeedbackBar, ...newScore}
    }
    return null
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  handleFullDiagnosticShown = () => {
    const {dispatch, project} = this.props
    dispatch(diagnosticIsShown(project))
    if (this.state.canShowFeedbackBar) {
      return
    }
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.setState({canShowFeedbackBar: true}), 13000)
  }

  render() {
    const {dispatch, featuresEnabled: {alpha: isUserAlpha}, evaluationUrl, isFirstTime,
      makeAdviceLink, profile, project, userYou} = this.props
    const {canShowFeedbackBar, isPoleEmploiChangelogShown, isShareBobShown} = this.state
    if (!project.diagnostic) {
      return <Redirect to={Routes.APP_UPDATED_PAGE} />
    }
    const diagnosticStyle = {
      backgroundColor: '#fff',
      flex: 1,
      margin: '0 auto',
      maxWidth: 1000,
      minWidth: isMobileVersion ? '100%' : 680,
    }
    const pageStyle = {
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }
    // TODO(pascal): Group FeedbackBar and ShareModal in a component as they
    // are closely related here.
    const hideBelowStyle = {
      transform: canShowFeedbackBar ? 'initial' : 'translateY(calc(100% + 10px))',
      ...SmoothTransitions,
    }
    const feedbackStyle = {
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: 5,
      boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      margin: '0 auto 10px',
      padding: '10px 10px 5px',
      pointerEvents: 'initial',
      width: 310,
      ...isMobileVersion ? hideBelowStyle : {},
    }
    const fixedBottomStyle = {
      bottom: 0,
      left: 0,
      pointerEvents: 'none',
      position: 'fixed',
      right: 0,
      zIndex: 1,
      ...hideBelowStyle,
    }
    return <PageWithNavigationBar
      page="project"
      navBarContent="Mon évaluation"
      isChatButtonShown={true} style={pageStyle}>
      <PoleEmploiChangelogModal
        isShown={isPoleEmploiChangelogShown} projectCreatedAt={project.createdAt}
        onClose={() => this.setState({isPoleEmploiChangelogShown: false})} />
      <Diagnostic
        diagnosticData={project.diagnostic}
        onFullDiagnosticShown={this.handleFullDiagnosticShown}
        onDiagnosticTextShown={() => dispatch(diagnosticTalkIsShown(project))}
        onDownloadAsPdf={() => dispatch(downloadDiagnosticAsPdf(project))}
        advices={project.advices}
        userName={profile.name}
        style={diagnosticStyle}
        {...{isFirstTime, isUserAlpha, makeAdviceLink, userYou}}
      />
      {!project.feedback ?
        <React.Fragment>
          <div style={isMobileVersion ? {overflow: 'hidden'} : fixedBottomStyle}>
            <FeedbackBar
              style={feedbackStyle} project={project} evaluationUrl={evaluationUrl} />
          </div>
          {isMobileVersion ? null : <div style={{height: 80}} />}
        </React.Fragment> : null}
      <ShareModal
        onClose={() => this.setState({isShareBobShown: false})} isShown={isShareBobShown}
        title={userYou('Toi aussi, aide tes amis', 'Vous aussi, aidez vos amis')}
        campaign="fs" visualElement="feedback"
        intro={<React.Fragment>
          <strong>{userYou('Envoie', 'Envoyez')}-leur directement ce lien <br /></strong>
          et on s'occupe du reste&nbsp;!
        </React.Fragment>} />
    </PageWithNavigationBar>
  }
}
const DiagnosticPage = connect((
  {app: {submetricsExpansion = {}}, user},
  {project: {advices = []}}) => ({
  canShowFeedbackBar: advices.some(({status}) => status === 'ADVICE_READ') ||
    !!Object.keys(submetricsExpansion).length,
  featuresEnabled: user.featuresEnabled || {},
  profile: user.profile || {},
  userYou: youForUser(user),
}))(DiagnosticPageBase)
