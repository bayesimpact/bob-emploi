import React from 'react'
import {browserHistory} from 'react-router'
import moment from 'moment'
moment.locale('fr')
import {CircularProgress} from 'components/progress'
import {ShortKey} from 'components/shortkey'

import {fetchPotentialChantiers, updateProjectChantiers, createActionPlan,
        setProjectProperty} from 'store/actions'
import {nextAdviceToRecommend, createProjectTitleComponents} from 'store/project'
import {USER_PROFILE_SHAPE} from 'store/user'
import {Routes} from 'components/url'

import {PageWithNavigationBar} from 'components/navigation'
import {PotentialChantiersLists} from './project/chantiers'
import {IntensityChangeButton, IntensityModal} from './project/intensity'
import {EditProjectModal} from './project/edit_project'
import {AdviceCard} from 'components/advisor'

import {JobGroupCoverImage, Colors, SmoothTransitions, Styles,
        SettingsButton} from 'components/theme'

class SummaryBox extends React.Component {
  static propTypes = {
    onEditProjectClick: React.PropTypes.func.isRequired,
    onIntensityButtonClick: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }

  render() {
    const {onEditProjectClick, onIntensityButtonClick, project, style} = this.props
    const containerStyle = {
      backgroundColor: Colors.DARK,
      color: '#fff',
      padding: 65,
      position: 'relative',
      textAlign: 'center',
      zIndex: 0,
      ...SmoothTransitions,
      ...Styles.CENTERED_COLUMN,
      ...style,
    }
    const headingStyle = {
      fontSize: 37,
      fontWeight: 'bold',
      letterSpacing: 1,
      textShadow: '0 0 10px rgba(0, 0, 0, 0.3)',
      textTransform: 'uppercase',
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const settingsButtonStyle = {
      position: 'absolute',
      right: 20,
      top: 20,
    }
    const intensityButtonStyle = {
      left: '50%',
      position: 'absolute',
      top: '100%',
      transform: 'translateX(-50%) translateY(-50%)',
    }
    return <div style={containerStyle}>
      <JobGroupCoverImage romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}} />
      <SettingsButton
          onClick={onEditProjectClick}
          style={settingsButtonStyle}>
        Éditer
      </SettingsButton>
      <div style={headingStyle}>
        <div style={{fontSize: 15}}>Mon plan d'action sur mesure</div>
        <div>{project.title}</div>
      </div>
      {project.intensity ? (
        <IntensityChangeButton
            projectIntensity={project.intensity} onClick={onIntensityButtonClick}
            style={intensityButtonStyle} />
      ) : null}
    </div>
  }
}


function getProjectFromProps(props) {
  const {params, user} = props
  const projectId = params.projectId || ''
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
    fadeOutTransitionDurationMillisec: React.PropTypes.number.isRequired,
    onDone: React.PropTypes.func,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
    userProfile: React.PropTypes.object.isRequired,
  }
  static defaultProps = {
    fadeOutTransitionDurationMillisec: 600,
  }

  state = {
    isFadingOut: false,
    waitingText: waitingTexts[0],
  }

  componentWillMount() {
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
      position: 'relative',
      zIndex: 0,
      ...style,
    }
    const boxStyle = {
      backgroundColor: '#fff',
      borderRadius: 10,
      opacity: isFadingOut ? 0 : 1,
      padding: '50px 100px',
      textAlign: 'center',
      ...SmoothTransitions,
    }
    const headerStyle = {
      color: Colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
    }
    const waitingNoticeStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 1.5,
      paddingBottom: 30,
    }
    return <div style={containerStyle}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={onDone} />
      <JobGroupCoverImage romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}} />
      <div style={boxStyle}>
        <header style={headerStyle}>{project.title}</header>
        <div style={{margin: 'auto', maxWidth: 360, paddingTop: 23}}>
          Merci, {userProfile.name}, pour votre patience !<br /><br />
          Nous analysons vos informations pour créer votre plan d'action sur mesure.
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


class ProjectPage extends React.Component {
  static propTypes = {
    app: React.PropTypes.object.isRequired,
    dispatch: React.PropTypes.func.isRequired,
    params: React.PropTypes.shape({
      projectId: React.PropTypes.string,
    }),
    user: React.PropTypes.object.isRequired,
  }

  state = {
    isEditProjectModalShown: false,
    isIntensityModalShown: false,
    isWaitingInterstitialShown: false,
  }

  componentWillMount() {
    const {params, user} = this.props
    const project = getProjectFromProps(this.props)
    const {projectId} = project
    if (!projectId) {
      this.setState({
        isLoadingPotentialChantiers: true,
        isWaitingInterstitialShown: true,
      })
    } else {
      if (projectId !== params.projectId) {
        browserHistory.replace(Routes.PROJECT_PAGE + '/' + projectId)
      }
      this.loadPotentialChantiers(projectId)
    }
    const hasAdviceToRecommend = user.featuresEnabled && user.featuresEnabled.advisor &&
      nextAdviceToRecommend(project)
    const mightShowChantier = !user.featuresEnabled || !user.featuresEnabled.advisor
    if (hasAdviceToRecommend ||
        mightShowChantier && !Object.keys(project.activatedChantiers || {}).length) {
      this.setState({isWaitingInterstitialShown: true})
    } else if (!project.intensity) {
      // This should not happen (having activated chantiers without an
      // intensity) but it happened at least once, so we catch the case.
      this.setState({isIntensityModalShown: true})
    }
  }

  componentWillReceiveProps(nextProps) {
    const {projectId} = getProjectFromProps(nextProps)
    if (!projectId) {
      return
    }
    if (projectId !== nextProps.params.projectId) {
      browserHistory.replace(Routes.PROJECT_PAGE + '/' + projectId)
      this.loadPotentialChantiers(projectId)
    }
  }

  loadPotentialChantiers(projectId) {
    const {app, dispatch} = this.props
    if (app.projectsPotentialChantiers[projectId || '']) {
      return
    }
    this.setState(
      {isLoadingPotentialChantiers: true},
      () => dispatch(fetchPotentialChantiers(projectId)).then(
        () => this.setState({isLoadingPotentialChantiers: false})))
  }

  handleUpdateChantiersSet = chantierIds => {
    const {dispatch, params} = this.props
    // TODO(pascal): Handle the case where no chantiers are selected (prevent
    // from saving maybe?).
    if (this.getIsFirstTime()) {
      dispatch(createActionPlan(params.projectId || '', chantierIds))
    } else {
      dispatch(updateProjectChantiers(params.projectId || '', chantierIds))
    }
  }

  handleIntensityChange = intensityLevel => {
    const {dispatch, params} = this.props
    this.setState({isIntensityModalShown: false})
    dispatch(setProjectProperty(params.projectId || '', {intensity: intensityLevel}, true))
  }

  handleWaitingInterstitialDone = () => {
    const project = getProjectFromProps(this.props)
    this.setState({
      isIntensityModalShown: !project.intensity,
      isWaitingInterstitialShown: false,
    })
  }

  getIsFirstTime = () => {
    const project = getProjectFromProps(this.props)
    return !Object.keys(project.activatedChantiers || {}).length
  }

  render() {
    const project = getProjectFromProps(this.props)
    const {app, user} = this.props
    const {isEditProjectModalShown, isIntensityModalShown,
        isLoadingPotentialChantiers, isWaitingInterstitialShown} = this.state

    const isFirstTime = this.getIsFirstTime()

    if (isWaitingInterstitialShown) {
      return <WaitingProjectPage
          userProfile={user.profile} style={{flex: 1}} project={project}
          onDone={this.handleWaitingInterstitialDone} />
    }

    if (user.featuresEnabled && user.featuresEnabled.advisor) {
      return <ProjectDashboardPage project={project} profile={user.profile} />
    }

    let innerPage
    const innerPageStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      flex: '1 0',
      paddingTop: 50,
      textAlign: 'center',
    }
    const potentialChantiers = app.projectsPotentialChantiers[project.projectId]
    if (isLoadingPotentialChantiers || !potentialChantiers) {
      innerPage = <div style={innerPageStyle}>
        <CircularProgress />
      </div>
    } else {
      const hasActions = !!(project.actions && project.actions.length)
      const introStyle = {
        color: Colors.CHARCOAL_GREY,
        lineHeight: 1.4,
        margin: 'auto',
        maxWidth: 590,
        paddingBottom: 50,
        textAlign: 'left',
      }
      innerPage = <div style={innerPageStyle}>
        {isFirstTime ? <div style={introStyle}>
          <div style={{fontSize: 16, fontWeight: 500, paddingBottom: 18}}>
            Voici les solutions possibles que nous avons identifiées afin de booster
            votre recherche d'emploi.
          </div>
          <div style={{fontSize: 14}}>
            En fonction des solutions que vous ajoutez à votre plan, nous vous proposerons
            chaque jour des actions concrètes pour avancer. Cliquez sur "Commencer mon
            plan d'action" en bas de page lorsque vous avez fini.
          </div>
        </div> : null}
        <PotentialChantiersLists potentialChantiers={potentialChantiers || {}}
            submitCaption={hasActions ? 'Enregistrer' : "Commencer mon plan d'action"}
            onUpdateSelection={this.handleUpdateChantiersSet} isFirstTime={isFirstTime}
            isIntensitySet={!!project.intensity}
            onDone={() => browserHistory.push(Routes.DASHBOARD_PAGE)} />
      </div>
    }

    const style = {
      backgroundColor: Colors.BACKGROUND_GREY,
      display: 'flex',
      flexDirection: 'column',
    }
    return <PageWithNavigationBar page="project" style={style} isContentScrollable={true}>
      <IntensityModal
          isShown={isIntensityModalShown}
          onClose={project.intensity ? () => this.setState({isIntensityModalShown: false}) : null}
          onChange={this.handleIntensityChange}
          projectIntensity={project.intensity} />
      <EditProjectModal
          isShown={isEditProjectModalShown}
          onClose={() => this.setState({isEditProjectModalShown: false})}
          project={project} />
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <SummaryBox
            project={project} style={{flexShrink: 0}}
            onIntensityButtonClick={() => this.setState({isIntensityModalShown: true})}
            onEditProjectClick={() => this.setState({isEditProjectModalShown: true})} />
        {innerPage}
      </div>
    </PageWithNavigationBar>
  }
}


class ProjectDashboardPage extends React.Component {
  static propTypes = {
    onSelectAdvice: React.PropTypes.func.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  renderHeader() {
    const {profile, project} = this.props
    const style = {
      backgroundColor: Colors.CHARCOAL_GREY,
      color: '#fff',
      padding: '50px 0',
      position: 'relative',
      textAlign: 'center',
      zIndex: 0,
    }
    const {what, where} = createProjectTitleComponents(project, profile.gender)
    return <header style={style}>
      <JobGroupCoverImage
          romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
          coverOpacity={1}
          opaqueCoverGradient={{
            left: Colors.CHARCOAL_GREY,
            middle: Colors.CHARCOAL_GREY,
            right: 'rgba(56, 63, 81, 0.7)'}} />
      <div style={{fontSize: 33, lineHeight: '36px'}}>
        <strong>{what}</strong> <span style={{fontStyle: 'italic'}}>{where}</span>
      </div>
    </header>
  }

  renderAdviceCards(advices) {
    const {onSelectAdvice, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const cardsContainerStyle = {
      margin: isMobileVersion ? '10px auto' : '25px auto',
    }
    const cardStyle = {
      margin: isMobileVersion ? '15px 10px' : '25px 20px',
    }
    return <div style={cardsContainerStyle}>
      {advices.map((advice, index) =>
        <AdviceCard
            priority={index + 1} key={advice.adviceId} advice={advice} style={cardStyle}
            onSelect={advice.engagementAction ? (() => onSelectAdvice(advice)) : null}
            {...extraProps} />
      )}
    </div>
  }

  render() {
    const {project} = this.props
    return <PageWithNavigationBar page="project"  isContentScrollable={true}>
      {this.renderHeader()}
      {this.renderAdviceCards(project.advices || [])}
    </PageWithNavigationBar>
  }
}


export {ProjectPage}
