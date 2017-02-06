import React from 'react'
import {browserHistory} from 'react-router'
import moment from 'moment'
moment.locale('fr')
import {CircularProgress} from 'components/progress'
import {ShortKey} from 'components/shortkey'

import config from 'config'
import {fetchPotentialChantiers, updateProjectChantiers, createActionPlan,
        setProjectProperty, acceptAdvice, declineAdvice} from 'store/actions'
import {nextAdviceToRecommend, createProjectTitleComponents,
        hasUserEverAcceptedAdvice} from 'store/project'
import {Routes} from 'components/url'

import {PageWithNavigationBar} from 'components/navigation'
import {PotentialChantiersLists} from './project/chantiers'
import {IntensityChangeButton, IntensityModal} from './project/intensity'
import {EditProjectModal} from './project/edit_project'
import {AdviceCard, AdvisorPage} from './project/advisor'
import {Modal} from 'components/modal'

import {JobGroupCoverImage, Colors, RoundButton, SmoothTransitions, Styles,
        SettingsButton} from 'components/theme'

// TODO(guillaume): Refactor that. Seriously.
const maybeS = count => count > 1 ? 's' : ''

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


class NumberOfRecommendationsModal extends React.Component {
  static propTypes = {
    numRecommendations: React.PropTypes.number.isRequired,
    onSubmit: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  state = {
    isShown: false,
  }

  componentDidMount() {
    if (!this.isShown) {
      this.setState({isShown: true})
    }
  }

  render() {
    const {numRecommendations, onSubmit, project, ...extraProps} = this.props
    const style = {
      fontSize: 14,
      lineHeight: 1.57,
      maxWidth: 480,
      padding: '0 60px 50px',
      textAlign: 'center',
    }
    return <div>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={onSubmit} />
      <JobGroupCoverImage romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}} />
      <Modal {...extraProps} style={style} isShown={this.state.isShown} backgroundCoverOpacity={0}>
        <div style={{fontSize: 23, marginTop: 40}}>
          <strong>{numRecommendations}&nbsp;
          solution{maybeS(numRecommendations)}</strong> identifiée{maybeS(numRecommendations)}
        </div>
        <img src={require('images/bayes-picto.svg')} style={{marginBottom: 15, marginTop: 30}} />
        <div>
          <p>
            Nous avons analysé vos critères, votre profil ainsi que votre marché
            pour <strong>déterminer les meilleures solutions</strong> pour
            accélérer votre recherche d'emploi.
          </p>
          <p>
            <strong>Consultez l'ensemble des solutions</strong> et sélectionnez les nouvelles
            pistes que vous souhaitez explorer. Nous vous aiderons ensuite à évaluer et saisir
            ces opportunités.
          </p>
        </div>
        <RoundButton
            onClick={onSubmit} type="validation" style={{marginTop: 25}}>
          Découvrir les solutions
        </RoundButton>
      </Modal>
    </div>
  }
}


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
    isNumberOfRecommendationsModalDismissed: false,
    isWaitingInterstitialShown: false,
    newRecommendations: [],
    numRecommendationsAcceptedOrDeclined: 0,
  }

  updateRecommendationList(project) {
    this.setState({
      newRecommendations: (project.advices || []).
          filter(advice => advice.status === 'ADVICE_RECOMMENDED'),
      numRecommendationsAcceptedOrDeclined: 0,
    })
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
    this.updateRecommendationList(project)
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
    const project = getProjectFromProps(this.props)
    const nextProject = getProjectFromProps(nextProps)
    if (nextProject && nextProject.advices) {
      if (!project || !project.advices || project.advices.length !== nextProject.advices.length) {
        this.updateRecommendationList(nextProject)
      }
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

  handleAcceptAdvice(project, advice) {
    const {numRecommendationsAcceptedOrDeclined} = this.state
    this.setState({numRecommendationsAcceptedOrDeclined: numRecommendationsAcceptedOrDeclined + 1})
    this.props.dispatch(acceptAdvice(project, advice))
  }

  handleDeclineAdvice(project, reason, advice) {
    const {numRecommendationsAcceptedOrDeclined} = this.state
    this.setState({numRecommendationsAcceptedOrDeclined: numRecommendationsAcceptedOrDeclined + 1})
    this.props.dispatch(declineAdvice(project, reason, advice))
  }

  render() {
    const project = getProjectFromProps(this.props)
    const {app, user} = this.props
    const {numRecommendationsAcceptedOrDeclined, isEditProjectModalShown, isIntensityModalShown,
        isLoadingPotentialChantiers, isNumberOfRecommendationsModalDismissed,
        isWaitingInterstitialShown, newRecommendations} = this.state

    const isFirstTime = this.getIsFirstTime()

    if (isWaitingInterstitialShown) {
      return <WaitingProjectPage
          userProfile={user.profile} style={{flex: 1}} project={project}
          onDone={this.handleWaitingInterstitialDone} />
    }

    if (user.featuresEnabled && user.featuresEnabled.advisor) {
      if (newRecommendations.length &&
          numRecommendationsAcceptedOrDeclined < newRecommendations.length) {
        const isFirstRecommendation = !hasUserEverAcceptedAdvice(project)
        const hasMultipleRecommendations = newRecommendations.length > 1
        const advice = newRecommendations[numRecommendationsAcceptedOrDeclined]
        if (!isNumberOfRecommendationsModalDismissed) {
          return <NumberOfRecommendationsModal numRecommendations={newRecommendations.length}
              onSubmit={() => this.setState({isNumberOfRecommendationsModalDismissed: true})}
              project={project} />
        }

        return <AdvisorPage
            {...this.props} project={project} advice={advice}
            recommendationNumber={numRecommendationsAcceptedOrDeclined + 1}
            numRecommendations={newRecommendations.length}
            onAccept={() => this.handleAcceptAdvice(project, advice)}
            showAckModalOnAccept={isFirstRecommendation && hasMultipleRecommendations}
            onDecline={reason => this.handleDeclineAdvice(project, reason, advice)} />
      }
      return <ProjectDashboardPage
          project={project} gender={user.profile && user.profile.gender}
          onSelectAdvice={advice => browserHistory.push(
            Routes.PROJECT_PAGE + '/' + project.projectId +
            Routes.ADVICE_SUB_PAGE + '/' + advice.adviceId)} />
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


const inactiveAdviceStatus = {
  ADVICE_CANCELED: true,
  ADVICE_DECLINED: true,
  ADVICE_NOT_RECOMMENDED: true,
}

class ProjectDashboardPage extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    onSelectAdvice: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    activeAdvices: [],
    areInactiveAdvicesShown: false,
    inactiveAdvices: [],
  }

  componentWillMount() {
    this.updateAdvices(this.props.project)
  }

  componentWillReceiveProps(props) {
    this.updateAdvices(props.project)
  }

  updateAdvices(project) {
    const adviceWithEngagement = (project.advices || []).
      filter(advice => advice.engagementAction && advice.engagementAction.title)
    this.setState({
      activeAdvices: adviceWithEngagement.
        filter(advice => advice.status === 'ADVICE_ACCEPTED' || advice.status === 'ADVICE_ENGAGED'),
      inactiveAdvices: adviceWithEngagement.filter(advice => inactiveAdviceStatus[advice.status]),
    })
  }

  renderHeader(innerStyle) {
    const {gender, project} = this.props
    const {activeAdvices} = this.state
    const style = {
      backgroundColor: Colors.CHARCOAL_GREY,
      color: '#fff',
      padding: '50px 0',
      position: 'relative',
      textAlign: 'center',
      zIndex: 0,
    }
    const boxStyle = {
      backgroundColor: 'rgba(255, 255, 255, .15)',
      borderRadius: '4px 0 0 4px',
      display: 'inline-box',
      fontSize: 13,
      fontStyle: 'italic',
      lineHeight: '30px',
      padding: '6px 12px',
    }
    const numAdvices = activeAdvices.length
    const numSteps = activeAdvices.
      reduce((sum, advice) =>
        sum + (advice.engagementAction && advice.engagementAction.steps || []).length, 0)
    const {what, where} = createProjectTitleComponents(project, gender)
    return <header style={style}>
      <JobGroupCoverImage
          romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
          coverOpacity={1}
          opaqueCoverGradient={{
            left: Colors.CHARCOAL_GREY,
            middle: Colors.CHARCOAL_GREY,
            right: 'rgba(56, 63, 81, 0.7)'}} />
      <div style={{fontSize: 33, lineHeight: '36px', ...innerStyle}}>
        <strong>{what}</strong> <span style={{fontStyle: 'italic'}}>{where}</span>
      </div>
      {numAdvices ? <div style={{marginTop: 10, ...innerStyle}}>
        <span style={boxStyle}>
          {numAdvices} solution{maybeS(numAdvices)}
        </span>
        <span style={{...boxStyle, borderRadius: '0 4px 4px 0', marginLeft: 1}}>
          {numSteps || 0} conseil{maybeS(numSteps)}
        </span>
      </div> : null}
    </header>
  }

  renderSectionTitle(children) {
    const titleStyle = {
      color: Colors.DARK,
      fontSize: 18,
      fontStyle: 'italic',
      fontWeight: 'bold',
      margin: '45px 0 15px',
      padding: '0 20px',
    }
    return <div style={titleStyle}>
      {children}
    </div>
  }

  renderNoAdvice(style) {
    return <div style={{textAlign: 'center', ...style}}>
      {this.renderSectionTitle('Plus de conseil disponible pour votre situation')}
      <img src={require('images/empty-tray-picto.svg')} style={{marginTop: 30}} />
    </div>
  }

  renderAdviceCards(advices, extraProps) {
    const {onSelectAdvice} = this.props
    const {isMobileVersion} = this.context
    const cardsContainerStyle = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'initial',
      flexWrap: isMobileVersion ? 'initial' : 'wrap',
      margin: isMobileVersion ? '10px auto' : '25px auto',
    }
    const cardStyle = {
      flexShrink: 0,
      margin: isMobileVersion ? '15px 10px' : '25px 20px',
      width: isMobileVersion ? 'initial' : 460,
    }
    return <div style={cardsContainerStyle}>
      {advices.map(advice =>
        <AdviceCard
            key={advice.adviceId} advice={advice} style={cardStyle}
            onSelect={() => onSelectAdvice(advice)} {...extraProps} />
      )}
    </div>
  }

  renderInactiveAdviceCards() {
    const {areInactiveAdvicesShown, inactiveAdvices} = this.state
    if (!inactiveAdvices.length) {
      return null
    }
    if (!areInactiveAdvicesShown) {
      return <div style={{textAlign: 'center'}}>
        <RoundButton type="back" onClick={() => this.setState({areInactiveAdvicesShown: true})}>
          Afficher les autres solutions
        </RoundButton>
      </div>
    }
    const noticeStyle = {
      color: Colors.COOL_GREY,
      fontSize: 15,
      fontStyle: 'italic',
      lineHeight: 1.4,
      padding: '0 20px',
    }
    return <div>
      {this.renderSectionTitle(
          `Accèder à l'ensemble des solutions disponibles sur ${config.productName}.`)}
      <div style={noticeStyle}>
        Ces différentes solutions ne vous ont pas été proposées car nous estimions
        qu'elles n'étaient pas forcément utiles pour vous. Mais nous pouvons nous
        tromper ! Dites-nous si l'une de ces solutions vous aurait été utile afin
        que nous puissions nous améliorer.
      </div>
      {this.renderAdviceCards(inactiveAdvices)}
    </div>
  }

  renderActiveAdviceCards() {
    const {activeAdvices} = this.state
    if (!activeAdvices) {
      return this.renderNoAdvice()
    }
    return this.renderAdviceCards(activeAdvices, {isRecommended: true})
  }

  render() {
    const innerStyle = {
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: 1000,
    }
    return <PageWithNavigationBar page="project"  isContentScrollable={true}>
      {this.renderHeader(innerStyle)}
      <div style={innerStyle}>
        {this.renderActiveAdviceCards()}
        {this.renderInactiveAdviceCards()}
      </div>
    </PageWithNavigationBar>
  }
}


export {ProjectPage}
