import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Redirect, Route, Switch} from 'react-router-dom'
import setPropType from 'es6-set-proptypes'

import {diagnosticIsShown, downloadDiagnosticAsPdf} from 'store/actions'
import {getTopicUrl} from 'store/advice'
import {getLockedAdvices} from 'store/points'
import {youForUser} from 'store/user'

import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {JobGroupCoverImage, CircularProgress, SmoothTransitions} from 'components/theme'
import {NEW_PROJECT_ID, Routes} from 'components/url'

import {Diagnostic} from './project/diagnostic'
import {FeedbackPage} from './project/feedback_bar'
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


const waitingTexts = [
  'Analyse du marché du travail dans votre région',
  'Analyse de votre situation actuelle',
  'Évaluation des axes stratégiques prioritaires',
  'Préparation des solutions potentielles',
]

const TOTAL_WAITING_TIME_MILLISEC = 8000


class WaitingProjectPage extends React.Component {
  static propTypes = {
    fadeOutTransitionDurationMillisec: PropTypes.number.isRequired,
    onDone: PropTypes.func,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userProfile: PropTypes.object.isRequired,
  }

  static defaultProps = {
    fadeOutTransitionDurationMillisec: 600,
  }

  state = {
    isFadingOut: false,
    waitingText: waitingTexts[0],
  }

  componentDidMount() {
    this.updateText(0)
  }

  componentWillUnmount() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  updateText = waitingTextIndex => {
    const {onDone, fadeOutTransitionDurationMillisec} = this.props
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
    const {onDone, project, style, userProfile} = this.props
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
          Merci {userProfile.name} pour votre patience&nbsp;!<br /><br />
          Nous analysons vos informations pour créer votre diagnostic personnalisé.
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


const FEEDBACK_TAB = 'evaluer'


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

    if (isWaitingInterstitialShown || !project.advices) {
      return <WaitingProjectPage
        userProfile={user.profile}
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
          evaluationUrl={`${baseUrl}/${FEEDBACK_TAB}`}
          urlOnClose={baseUrl} />} />
      {/* Got an unknown tab, redirect to base URL to switch to default tab. */}
      <Redirect to={`${baseUrl}${search}${hash}`} />
    </Switch>
  }
}


class DiagnosticPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.shape({
      poleEmploi: PropTypes.bool,
    }).isRequired,
    isFirstTime: PropTypes.bool,
    lockedAdvices: setPropType.isRequired,
    makeAdviceLink: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      name: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      advices: PropTypes.array,
      diagnostic: PropTypes.object,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isPoleEmploiChangelogShown: this.props.featuresEnabled.poleEmploi,
  }

  render() {
    const {dispatch, isFirstTime, lockedAdvices, makeAdviceLink, profile, project,
      userYou} = this.props
    const {isPoleEmploiChangelogShown} = this.state
    if (!project.diagnostic) {
      return <Redirect to={Routes.APP_UPDATED_PAGE} />
    }
    const diagnosticStyle = {
      backgroundColor: '#fff',
      flex: 1,
      // TODO(marielaure): Propagate font family to children that still needs GTWalsheim.
      fontFamily: 'GTWalsheim',
      margin: '0 auto',
      maxWidth: 1000,
      minWidth: isMobileVersion ? '100%' : 680,
    }
    const pageStyle = {
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
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
        onShown={() => dispatch(diagnosticIsShown(project))}
        onDownloadAsPdf={() => dispatch(downloadDiagnosticAsPdf(project))}
        advices={project.advices}
        userName={profile.name}
        style={diagnosticStyle}
        {...{isFirstTime, lockedAdvices, makeAdviceLink, userYou}}
      />
    </PageWithNavigationBar>
  }
}
const DiagnosticPage = connect(({user}, {project: {advices = []}}) => ({
  featuresEnabled: user.featuresEnabled || {},
  lockedAdvices: getLockedAdvices(user, advices),
  profile: user.profile || {},
  userYou: youForUser(user),
}))(DiagnosticPageBase)
