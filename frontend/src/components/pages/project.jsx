import React from 'react'
import {connect} from 'react-redux'
import {browserHistory} from 'react-router'
import moment from 'moment'
moment.locale('fr')
import Radium from 'radium'
import {CircularProgress} from 'components/progress'
import {ShortKey} from 'components/shortkey'

import {fetchPotentialChantiers, updateProjectChantiers, createActionPlan,
        setProjectProperty, deleteProject, acceptAdvice, declineAdvice} from 'store/actions'
import {shouldShowAdvice} from 'store/project'
import {Routes} from 'components/url'

import {PageWithNavigationBar} from 'components/navigation'
import {NEW_PROJECT_ID} from 'components/new_project'
import {PotentialChantiersLists} from './project/chantiers'
import {IntensityChangeButton, IntensityModal} from './project/intensity'
import {EditProjectModal} from './project/edit_project'
import {AdvisorPage} from './project/advisor'
import {StickyActionPage} from './dashboard/sticky'

import {Modal, ModalHeader} from 'components/modal'
import {CoverImage, Colors, RoundButton, SmoothTransitions, Styles,
        SettingsButton} from 'components/theme'


class SummaryBox extends React.Component {
  static propTypes = {
    onDeleteProjectClick: React.PropTypes.func.isRequired,
    onEditProjectClick: React.PropTypes.func.isRequired,
    onIntensityButtonClick: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
  }

  state = {
    isConfirmDeleteModalShown: false,
    isSettingsMenuShown: false,
  }

  render() {
    const {onDeleteProjectClick, onEditProjectClick, onIntensityButtonClick,
           project, style} = this.props
    const {isSettingsMenuShown} = this.state
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
      <CoverImage url={project.coverImageUrl} style={{zIndex: -1}} />
      <SettingsButton
          onClick={() => this.setState({isSettingsMenuShown: true})}
          style={settingsButtonStyle}>
        Éditer
      </SettingsButton>
      <DropDownMenu
          isShown={isSettingsMenuShown}
          style={settingsButtonStyle}
          onBlur={() => this.setState({isSettingsMenuShown: false})}>
        <MenuItem onClick={onEditProjectClick}>
          Modifer mon projet
        </MenuItem>
        <MenuItem onClick={onDeleteProjectClick}>
          Supprimer mon projet
        </MenuItem>
      </DropDownMenu>
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


class DropDownMenu extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    isShown: React.PropTypes.bool,
    onBlur: React.PropTypes.func,
    style: React.PropTypes.object,
  }

  state = {
    isFullyShown: false,
  }

  componentDidMount() {
    if (this.props.isShown) {
      this.setState({isFullyShown: true}, () => this.div.focus())
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.isShown && !prevProps.isShown) {
      this.setState({isFullyShown: true})
      this.div.focus()
    } else if (!this.props.isShown && prevProps.isShown) {
      clearTimeout(this.timeout)
      this.timeout = setTimeout(() => this.setState({isFullyShown: false}), 450)
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  assignDiv = div => {
    this.div = div
  }

  render() {
    const {children, isShown, onBlur, style} = this.props
    const {isFullyShown} = this.state
    if (!isShown && !isFullyShown) {
      return null
    }
    const containerStyle = {
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      opacity: (isFullyShown && isShown) ? 1 : 0,
      overflow: 'hidden',
      transform: `translateY(${(isFullyShown && isShown) ? '0' : '-40px'})`,
      transition: '450ms',
      ...style,
    }
    return <div
        style={containerStyle} ref={this.assignDiv} onBlur={onBlur}
        tabIndex={isFullyShown && isShown ? 0 : -1}>
      {children}
    </div>
  }
}


class MenuItemBase extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
  }

  render() {
    const {children, ...extraProps} = this.props
    const style = {
      ':hover': {backgroundColor: Colors.MODAL_PROJECT_GREY},
      backgroundColor: '#fff',
      border: 'none',
      color: Colors.SLATE,
      cursor: 'pointer',
      fontSize: 13,
      padding: '12px 14px',
      textAlign: 'left',
    }
    return <button {...extraProps} style={style}>
      {children}
    </button>
  }
}
const MenuItem = Radium(MenuItemBase)


class ConfirmDeleteModalBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    onClose: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  handleDelete = () => {
    const {dispatch, project} = this.props
    dispatch(deleteProject(project))
    browserHistory.push(Routes.DASHBOARD_PAGE)
  }

  render() {
    const {onClose} = this.props
    return <Modal {...this.props}>
      <ModalHeader style={{justifyContent: 'center'}}>
        Voulez-vous vraiment supprimer votre projet&nbsp;?
      </ModalHeader>
      <div style={{fontSize: 14, maxWidth: 630, padding: '30px 35px'}}>
        Une fois le projet supprimé vous perdrez votre plan d'action ainsi que
        toutes les actions que vous avez faites sur ce projet.
      </div>
      <div style={{display: 'flex', justifyContent: 'flex-end', padding: 15}}>
        <RoundButton type="discreet" onClick={onClose} isNarrow={true} style={{marginRight: 15}}>
          Annuler
        </RoundButton>
        <RoundButton type="deletion" onClick={this.handleDelete} isNarrow={true}>
          Supprimer le projet
        </RoundButton>
      </div>
    </Modal>
  }
}
const ConfirmDeleteModal = connect()(ConfirmDeleteModalBase)


function getProjectFromProps(props) {
  const {params, user} = props
  const projectId = params.projectId || ''
  if (projectId === NEW_PROJECT_ID) {
    // Find a project that has no "created_at" timestamp yet.
    // TODO(pascal): Check that find does not break IE 11.
    const project = (user.projects || []).find(project => !project.createdAt)
    if (project) {
      return project
    }
    // Return most recent projects.
    const sortedProjects = (user.projects || []).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1)
    if (sortedProjects.length) {
      return sortedProjects[0]
    }
  }
  return (user.projects || []).find(project => project.projectId === projectId) || {}
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
    onDone: React.PropTypes.func,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
    userProfile: React.PropTypes.object.isRequired,
  }

  state = {
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
    if (waitingTextIndex >= waitingTexts.length) {
      this.props.onDone()
      return
    }
    this.setState({waitingText: waitingTexts[waitingTextIndex]})
    this.timeout = setTimeout(
      () => this.updateText(waitingTextIndex + 1),
      TOTAL_WAITING_TIME_MILLISEC / waitingTexts.length)
  }

  render() {
    const {onDone, project, style, userProfile} = this.props
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
      padding: '50px 100px',
      textAlign: 'center',
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
      <CoverImage url={project.coverImageUrl} style={{zIndex: -1}} />
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
      projectId: React.PropTypes.string.isRequired,
    }),
    user: React.PropTypes.object.isRequired,
  }

  state = {
    isConfirmDeleteModalShown: false,
    isEditProjectModalShown: false,
    isIntensityModalShown: false,
    isWaitingInterstitialShown: false,
  }

  componentWillMount() {
    const {params} = this.props
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
    if (!Object.keys(project.activatedChantiers || {}).length) {
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
    if (app.projectsPotentialChantiers[projectId]) {
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
    dispatch(setProjectProperty(params.projectId, {intensity: intensityLevel}, true))
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

  handleAcceptAdvice(project) {
    // TODO(pascal): Redirect to Sticky Action Full Page.
    this.props.dispatch(acceptAdvice(project))
  }

  handleDeclineAdvice(project, reason) {
    this.props.dispatch(declineAdvice(project, reason))
  }

  render() {
    const project = getProjectFromProps(this.props)
    const {app, user} = this.props
    const {isConfirmDeleteModalShown, isIntensityModalShown, isLoadingPotentialChantiers,
           isWaitingInterstitialShown, isEditProjectModalShown} = this.state

    const isFirstTime = this.getIsFirstTime()

    if (user.featuresEnabled && user.featuresEnabled.advisor
        && project.adviceStatus === 'ADVICE_ACCEPTED' && project.stickyActions
        && project.stickyActions.length === 1) {
      return <StickyActionPage
          action={project.stickyActions[0]}
          onDone={() => alert("En cours d'implémentation")}
          onStop={() => alert("En cours d'implémentation")} />
    }


    if (isWaitingInterstitialShown) {
      return <WaitingProjectPage
          userProfile={user.profile} style={{flex: 1}} project={project}
          onDone={this.handleWaitingInterstitialDone} />
    }

    if (user.featuresEnabled && user.featuresEnabled.advisor && shouldShowAdvice(project)) {
      return <AdvisorPage
          {...this.props} project={project}
          onAccept={() => this.handleAcceptAdvice(project)}
          onDecline={reason => this.handleDeclineAdvice(project, reason)} />
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
      <ConfirmDeleteModal
          isShown={isConfirmDeleteModalShown}
          onClose={() => this.setState({isConfirmDeleteModalShown: false})}
          project={project} />
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <SummaryBox
            project={project} style={{flexShrink: 0}}
            onIntensityButtonClick={() => this.setState({isIntensityModalShown: true})}
            onEditProjectClick={() => this.setState({isEditProjectModalShown: true})}
            onDeleteProjectClick={() => this.setState({isConfirmDeleteModalShown: true})} />
        {innerPage}
      </div>
    </PageWithNavigationBar>
  }
}


export {ProjectPage}
