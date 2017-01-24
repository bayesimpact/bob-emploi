import {browserHistory} from 'react-router'
import React from 'react'
import _ from 'underscore'
import Radium from 'radium'
import {connect} from 'react-redux'

import {ShortKey} from 'components/shortkey'
import {isActionStuck} from 'store/action'
import {moveUserDatesBackOneDay, openNewProjectModal, setUserInteraction,
        refreshActionPlan} from 'store/actions'
import {maybeContractPrefix, readableDay} from 'store/french'

import {CircularProgress} from 'components/progress'
import {Action, ActionDescriptionModal} from 'components/actions'
import {DebugModal} from 'components/debug'
import {GamificationModal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {StickyActionPane} from 'components/sticky'
import {Colors, RoundButton, Styles} from 'components/theme'
import {Routes} from 'components/url'
import {allActionsById, allActiveActions, allDoneAndPastActionsAndProjects,
        projectsWithOpenActions, areAllActionsDoneForToday,
        isNewActionPlanNeeded, allStickyActions, findAction} from 'store/project'
import {isFirstActionPlanReadyToBeCreated, shouldShowFirstWelcomeBackScreen,
        shouldShowSecondWelcomeBackScreen} from 'store/main_selectors'
import {DailyGoal} from './dashboard/daily_goal'
import {ProjectCard} from './dashboard/project_card'
import {ActionsHistory} from './dashboard/actions_history'


const projectsAsSet = projects => _.indexBy(projects || [], 'projectId')

const GENERATING_ACTION_PLAN_INTERSTITIAL_DURATION_MILLISEC = 5000


// The logic to decide what to show and when is documented at
// http://go/bob:dashboard-logic.
class DashboardPageBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isFirstActionPlanReadyToBeCreated: React.PropTypes.bool,
    isFirstWelcomeBackScreenNeeded: React.PropTypes.bool,
    isNewActionPlanNeeded: React.PropTypes.bool,
    isSecondWelcomeBackScreenNeeded: React.PropTypes.bool,
    openActionId: React.PropTypes.string,
    user: React.PropTypes.object.isRequired,
  }

  state = {
    hasShownFirstDayModal: false,
    hasTriedToRefreshActionPlan: false,
    isCreatingActionPlanForTheFirstTime: false,
    isCreatingActionPlanShown: false,
    isDebugModalShown: false,
    isFirstDayModalShown: false,
    isHistoryShown: false,
    openAction: null,
  }

  componentWillMount() {
    const {openActionId, user} = this.props
    // On top we show an action ID from URL if requested.
    if (openActionId) {
      const actionToOpen = allActionsById(user.projects)[openActionId]
      if (actionToOpen) {
        this.setState({openAction: actionToOpen})
        return
      }
      browserHistory.push(Routes.DASHBOARD_PAGE)
    }

    this.componentWillReceiveProps(this.props)
  }

  componentWillReceiveProps(nextProps) {
    const {isFirstActionPlanReadyToBeCreated, isFirstWelcomeBackScreenNeeded,
           isNewActionPlanNeeded, isSecondWelcomeBackScreenNeeded, openActionId,
           user} = nextProps
    const {hasShownFirstDayModal, isFirstDayModalShown, openAction} = this.state

    if (openActionId) {
      // Do not show anything below an action loaded by URL.
      return
    }

    if (isFirstActionPlanReadyToBeCreated) {
      if (!hasShownFirstDayModal) {
        this.setState({hasShownFirstDayModal: true, isFirstDayModalShown: true})
        // Show the first day modal.
        return
      }
      if (isFirstDayModalShown) {
        // Do not show anything below the first day modal.
        return
      }
    }

    if (!hasShownFirstDayModal && (
          isFirstWelcomeBackScreenNeeded || isSecondWelcomeBackScreenNeeded)) {
      // Do not show anything below welcome back modals.
      return
    }

    if (!hasShownFirstDayModal && isNewActionPlanNeeded) {
      this.createActionPlan()
    }

    // The open action might have new data, although the openAction state would
    // not be updated.
    // TODO(pascal): Find a better way to do this, it's lame to dig all actions
    // of all projects to find it.
    if (openAction && user !== this.props.user) {
      this.setState((prevState, props) => {
        if (!prevState.openAction) {
          return {}
        }
        return {openAction: findAction(props.user.projects, prevState.openAction)}
      })
    }
  }

  componentWillUnmount() {
    clearTimeout(this.createPlanTimeout)
    clearTimeout(this.timeout)
  }

  fastForward = () => {
    const {dispatch, user} = this.props
    if (this.state.isCreatingActionPlanShown) {
      this.setState({isCreatingActionPlanShown: false})
      return
    }
    const projects = user.projects || []
    if (projects.length) {
      browserHistory.push(Routes.PROJECT_PAGE + '/' + projects[0].projectId)
    } else {
      dispatch(openNewProjectModal())
    }
  }

  handleActionModalClose = () => {
    this.setState({openAction: null})
    if (this.props.openActionId) {
      browserHistory.push(Routes.DASHBOARD_PAGE)
    }
  }

  handleFirstDayModalClose = () => {
    this.setState({isFirstDayModalShown: false})
    this.createActionPlan()
  }

  handleWelcomeBackModalClose = interaction => {
    this.props.dispatch(setUserInteraction(interaction))
  }

  createActionPlan = () => {
    const {hasTriedToRefreshActionPlan} = this.state
    const {user} = this.props
    if (hasTriedToRefreshActionPlan) {
      return
    }
    const isCreatingActionPlanForTheFirstTime =
      user.projects && user.projects.length === 1 && !user.projects[0].actions &&
      !user.projects[0].pastActions && !user.deletedProjects
    this.setState({
      hasTriedToRefreshActionPlan: true,
      isCreatingActionPlanForTheFirstTime,
      isCreatingActionPlanShown: true,
    })
    this.timeout = setTimeout(() => {
      this.setState({isCreatingActionPlanShown: false})
    }, GENERATING_ACTION_PLAN_INTERSTITIAL_DURATION_MILLISEC)
    this.createPlanTimeout = setTimeout(() => {
      this.setState({hasTriedToRefreshActionPlan: false})
    }, 3600000)
    this.props.dispatch(refreshActionPlan())
  }

  moveToTomorrow = () => {
    const {dispatch} = this.props
    dispatch(moveUserDatesBackOneDay()).then(response => {
      clearTimeout(this.createPlanTimeout)
      this.setState({hasTriedToRefreshActionPlan: false})
      return response
    })
  }

  render() {
    const {dispatch, isFirstWelcomeBackScreenNeeded, isSecondWelcomeBackScreenNeeded,
           openActionId, user} = this.props
    const {hasShownFirstDayModal, isCreatingActionPlanForTheFirstTime,
           isCreatingActionPlanShown, isDebugModalShown, isFirstDayModalShown,
           isHistoryShown, openAction} = this.state
    const pastActionsAndProjects = allDoneAndPastActionsAndProjects(user.projects)
    const canShowAnyWelcomeBackScreen =
      !openAction && !isFirstDayModalShown && !hasShownFirstDayModal
    const isSecondWelcomeBackScreenShown =
      canShowAnyWelcomeBackScreen && isSecondWelcomeBackScreenNeeded
    const isFirstWelcomeBackScreenShown =
      canShowAnyWelcomeBackScreen && isFirstWelcomeBackScreenNeeded &&
      !isSecondWelcomeBackScreenNeeded
    const isAnythingBelowModalShown = !(
      openActionId || isFirstDayModalShown || isFirstWelcomeBackScreenShown ||
      isSecondWelcomeBackScreenShown)
    const isWelcomePageShown = !(user.projects && user.projects.length)
    const style = {
      backgroundColor: Colors.BACKGROUND_GREY,
      display: 'flex',
    }
    // TODO(pascal): Fix the layout when one of the column is higher than the
    // screen.
    return <PageWithNavigationBar style={style} page="dashboard" isContentScrollable={true}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={this.fastForward} />
      <ShortKey keyCode="KeyY" ctrlKey={true} shiftKey={true} onKeyPress={this.moveToTomorrow} />

      <ShortKey
          keyCode="KeyE" ctrlKey={true} shiftKey={true}
          onKeyPress={() => this.setState({isDebugModalShown: true})} />

      {isAnythingBelowModalShown ? isWelcomePageShown ?
        <WelcomePage dispatch={dispatch} style={{flex: 1}} /> :
        <DashboardMainContent
            isCreatingActionPlanShown={isCreatingActionPlanShown}
            user={user} onOpenAction={openAction => this.setState({openAction})}
            onShowActionHistoryClick={() => this.setState({isHistoryShown: true})}
            isCreatingActionPlanForTheFirstTime={isCreatingActionPlanForTheFirstTime} /> : null}

      {isAnythingBelowModalShown ? <DashboardSidebar
          projects={user.projects}
          isWelcomePageShown={isWelcomePageShown}
          onNewProjectClick={() => dispatch(openNewProjectModal())} /> : null}

      {/* Modals on top of dashboard. The order defines which one is on top. */}

      <DebugModal
          onClose={() => this.setState({isDebugModalShown: false})}
          isShown={isDebugModalShown} />
      <ActionsHistory
          isShown={isHistoryShown} actionsAndProjects={pastActionsAndProjects}
          onClose={() => this.setState({isHistoryShown: false})}
          onOpenAction={openAction => this.setState({openAction})} />
      <ActionDescriptionModal
          isShown={!!(openAction && !isActionStuck(openAction))}
          onClose={this.handleActionModalClose}
          action={openAction} gender={user.gender} />
      <StickyActionPane
          isShown={!!(openAction && isActionStuck(openAction))}
          onClose={this.handleActionModalClose} action={openAction} />
      <FirstDayModal
          isShown={isFirstDayModalShown}
          onClose={this.handleFirstDayModalClose} />
      <WelcomeBackModal
          isShown={isFirstWelcomeBackScreenShown}
          onClose={() => this.handleWelcomeBackModalClose('hasSeenFirstWelcomeBack')} />
      <WelcomeBackModal
          isShown={isSecondWelcomeBackScreenShown}
          onClose={() => this.handleWelcomeBackModalClose('hasSeenSecondWelcomeBack')} />
    </PageWithNavigationBar>
  }
}
const DashboardPage = connect(({app, user}, {params}) => {
  return {
    isFirstActionPlanReadyToBeCreated: isFirstActionPlanReadyToBeCreated(user),
    isFirstWelcomeBackScreenNeeded: shouldShowFirstWelcomeBackScreen(user),
    isNewActionPlanNeeded: isNewActionPlanNeeded(user.projects),
    isSecondWelcomeBackScreenNeeded: shouldShowSecondWelcomeBackScreen(user),
    openActionId: params.actionId,
    user,
  }
})(DashboardPageBase)


class DashboardSidebar extends React.Component {
  static propTypes = {
    isWelcomePageShown: React.PropTypes.bool,
    onNewProjectClick: React.PropTypes.func.isRequired,
    projects: React.PropTypes.array,
  }

  render() {
    const {projects, isWelcomePageShown, onNewProjectClick} = this.props
    const projectsStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 15px',
      width: 400,
    }
    return <div style={projectsStyle}>
      {(projects || []).map((project, i) => {
        return <ProjectCard
            key={project.projectId || i} project={project}
            style={{marginBottom: 20}} />
      })}

      {isWelcomePageShown ? null :
      <RoundButton
          type="discreet" isNarrow={true}
          onClick={onNewProjectClick}
          style={{alignSelf: 'center', letterSpacing: .5}}>
        Ajouter un nouveau projet
      </RoundButton>
      }
    </div>

  }
}


class DashboardMainContent extends React.Component {
  static propTypes = {
    isCreatingActionPlanForTheFirstTime: React.PropTypes.bool,
    isCreatingActionPlanShown: React.PropTypes.bool,
    onOpenAction: React.PropTypes.func.isRequired,
    onShowActionHistoryClick: React.PropTypes.func.isRequired,
    transitionDurationMs: React.PropTypes.number,
    user: React.PropTypes.object.isRequired,
  }
  static defaultProps = {
    transitionDurationMs: 600,
  }

  constructor(props) {
    super(props)
    const projects = projectsWithOpenActions(props.user.projects)
    this.state = {
      futureProjects: projectsAsSet(projects),
      previousProjects: projects,
    }
  }

  componentWillReceiveProps(nextProps) {
    const projects = projectsWithOpenActions(nextProps.user.projects)
    this.setState({
      futureProjects: projectsAsSet(projects),
    })
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.setState({previousProjects: projects})
    }, nextProps.transitionDurationMs)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }


  render() {
    const {isCreatingActionPlanForTheFirstTime, isCreatingActionPlanShown,
           onOpenAction, onShowActionHistoryClick, transitionDurationMs, user} = this.props
    const {previousProjects, futureProjects} = this.state
    const allActions = allActiveActions(user.projects)
    const pastActions = allDoneAndPastActionsAndProjects(user.projects)
    const numDoneActions = allActions.filter(action => action.status === 'ACTION_DONE').length
    const projectWithOpenActions = previousProjects
    const isFinishDashboardShown = areAllActionsDoneForToday(user.projects || [], previousProjects)
    const historyLinkStyle = {
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 44,
    }
    const finishTextStyle = {
      color: Colors.SLATE,
      fontSize: 14,
      fontWeight: 'bold',
      lineHeight: 1.4,
      textAlign: 'center',
    }
    const stickyActionsContainer = {
      alignSelf: 'stretch',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.2)',
      marginBottom: 35,
    }
    const stickyActions = allStickyActions(user.projects)
    return <div style={{flex: 1, minWidth: 400, padding: '0 50px 40px', ...Styles.CENTERED_COLUMN}}>
      <div style={{alignItems: 'center', display: 'flex', flexShrink: 0, height: 220}}>
        <DailyGoal
            numerator={numDoneActions} denominator={allActions.length}
            isFinishDashboardShown={isFinishDashboardShown}
            isCreatingActionPlanShown={isCreatingActionPlanShown}
            isCreatingActionPlanForTheFirstTime={isCreatingActionPlanForTheFirstTime} />
      </div>

      {stickyActions.length ? <div style={stickyActionsContainer}>
        {stickyActions.map(({action, project}) => <Action
              action={action} project={project} key={action.actionId}
              onOpen={() => onOpenAction(action)} />)}
      </div> : null}

      <Separator
          style={{alignSelf: 'stretch', marginBottom: 45}}
          hasActions={!!projectWithOpenActions.length && !isCreatingActionPlanShown} />

      {isCreatingActionPlanShown ? null : projectWithOpenActions.map(project => <ProjectActions
          key={project.projectId} futureProject={futureProjects[project.projectId]}
          project={project} style={{alignSelf: 'stretch', marginBottom: 45}}
          onOpenAction={onOpenAction}
          transitionDurationMs={transitionDurationMs} />)}

      {/* TODO(stephan): Add fade between the interstitial and main content */}
      {isCreatingActionPlanShown ? <GeneratingActionPlanInterstitial
          isDayOne={isCreatingActionPlanForTheFirstTime} /> : null}

      {!isCreatingActionPlanShown && isFinishDashboardShown ? <div style={finishTextStyle}>
        C'est tout pour aujourd'hui !<br />
        Revenez demain pour découvrir votre nouvelle sélection d'actions.
      </div> : null}

      <div style={{flex: 1}} />

      {!isCreatingActionPlanShown && pastActions.length ? <RoundButton
          type="discreet" isNarrow={true}
          onClick={onShowActionHistoryClick} style={historyLinkStyle}>
        Mes actions des jours précédents ({pastActions.length})
      </RoundButton> : null}
    </div>
  }
}

class GeneratingActionPlanInterstitial extends React.Component {
  static propTypes = {
    isDayOne: React.PropTypes.bool,
  }

  render() {
    const style = {
      ...Styles.CENTERED_COLUMN,
      color: Colors.SLATE,
      textAlign: 'center',
    }
    const headerStyle = {
      fontSize: 25,
      fontWeight: 'bold',
      lineHeight: 0.96,
      marginBottom: 50,
      marginTop: 18,
    }
    const textStyle = {
      fontSize: 14,
      lineHeight: 1.43,
      width: 480,
    }
    return <div style={style}>
      <div style={headerStyle}>Voyons ce que nous pouvons faire pour vous aujourd'hui&nbsp;!</div>
      {this.props.isDayOne ?
        <div style={textStyle}>
          Commençons simple, nous apprendrons comment mieux vous aider au fil des jours&nbsp;!
        </div> :
        <div style={textStyle}>
          N'oubliez pas de nous dire quelles actions vous ont été utiles&nbsp;!
          Cela nous aidera à faire toujours mieux par la suite.
        </div>}
      <CircularProgress style={{marginTop: 40}} />
      <div style={{...textStyle, color: Colors.SKY_BLUE, marginTop: 30}}>
        Génération de vos actions du jour…
      </div>
    </div>
  }
}


class WelcomePage extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    style: React.PropTypes.object,
  }

  render() {
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.BACKGROUND_GREY,
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      lineHeight: 1.88,
      textAlign: 'center',
      ...this.props.style,
    }
    const dayOneIconStyle = {
      backgroundColor: Colors.SKY_BLUE,
      borderRadius: '100%',
      height: 122,
      margin: '32px auto',
      width: 122,
    }
    const separatorStyle = {
      alignSelf: 'stretch',
      borderBottom: 'none',
      borderTop: 'solid 1px ' + Colors.SILVER,
      margin: '0 50px 50px',
    }
    const titleStyle = {
      color: Colors.SLATE,
      fontSize: 25,
      fontWeight: 'bold',
      margin: '12px 0 0',
      textAlign: 'center',
    }
    const explanationStyle = {
      color: Colors.SLATE,
      fontSize: 14,
      lineHeight: 1.43,
      margin: 38,
      maxWidth: 480,
      textAlign: 'center',
    }
    return <div style={style}>
      <div style={{alignItems: 'center', display: 'flex', height: 220, justifyContent: 'center'}}>
        <img style={dayOneIconStyle} src={require('images/day-1-picto.svg')} />
      </div>

      <hr style={separatorStyle} />

      <h1 style={titleStyle}>
        Boostez votre recherche d'emploi
      </h1>

      <div style={explanationStyle}>
        Pour chaque métier que vous recherchez, nous allons vous aider à créer
        un <strong>plan d'action sur mesure</strong>.<br />

        <br />

        En fonction de ce plan, nous vous proposerons ensuite des <strong>actions
        simples et concrètes</strong> tous les jours.
      </div>

      <RoundButton
          type="validation" style={{margin: 12}}
          onClick={() => this.props.dispatch(openNewProjectModal())}>
        Créer un plan d'action pour un métier
      </RoundButton>
    </div>
  }
}


class ProjectActions extends React.Component {
  static propTypes = {
    futureProject: React.PropTypes.object,
    onOpenAction: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    transitionDurationMs: React.PropTypes.number.isRequired,
  }

  getCurrentActions(project) {
    return (project && project.actions || []).filter(
        action => action.status === 'ACTION_CURRENT' || action.status === 'ACTION_UNREAD')
  }

  render() {
    const {futureProject, onOpenAction, project, transitionDurationMs, ...extraProps} = this.props
    const currentActions = this.getCurrentActions(project)
    const futureActions = _.indexBy(this.getCurrentActions(futureProject), 'actionId')
    const numPastActions = (project.pastActions || []).length
    if (!numPastActions && !currentActions.length) {
      return null
    }
    const headerStyle = {
      color: Colors.COOL_GREY,
      fontSize: 12,
      fontWeight: 'bold',
      letterSpacing: 1,
      marginBottom: 10,
      textTransform: 'uppercase',
    }
    const title = 'Pour avancer sur votre plan ' + maybeContractPrefix(
        'de ', "d'", project.title)
    const actionStyle = isStillShown => ({
      maxHeight: isStillShown ? 60 : 0,
      overflow: isStillShown ? 'initial' : 'hidden',
      transition: transitionDurationMs + 'ms',
    })
    return <div {...extraProps}>
      <header style={headerStyle}>{title}</header>
      <div style={{boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.2)', marginBottom: 19}}>
        {currentActions.map(action => <Action
            style={actionStyle(!!futureActions[action.actionId])}
            onOpen={() => onOpenAction(action)}
            key={action.actionId} action={action} project={project} />)}
      </div>
    </div>
  }
}


class SeparatorBase extends React.Component {
  static propTypes = {
    hasActions: React.PropTypes.bool,
    style: React.PropTypes.object,
  }

  render() {
    const {hasActions, style} = this.props
    const containerStyle = {
      alignItems: 'baseline',
      display: 'flex',
      fontWeight: 500,
      ...style,
    }
    const separatorStyle = {
      borderBottom: 'solid 1px',
      color: Colors.SILVER,
      flex: 1,
      margin: '0 18px',
    }
    const tooltipStyle = {
      color: Colors.DARK,
      fontSize: 14,
      fontWeight: 'initial',
      lineHeight: 1.5,
      padding: '30px 40px',
      textAlign: 'left',
      width: 435,
    }
    const tooltipAnchorStyle = {
      ':focused': {color: Colors.SKY_BLUE},
      ':hover': {color: Colors.SKY_BLUE},
      color: Colors.COOL_GREY,
      cursor: 'pointer',
      fontSize: 13,
      padding: '0 0 8px',
      textDecoration: 'underline',
    }
    return <div style={containerStyle}>
      {hasActions ? <span style={{color: Colors.SLATE, fontSize: 18}}>
        Vos actions pour le {readableDay()}
      </span> : null}
      <span style={separatorStyle} />
      {hasActions ? <span style={tooltipAnchorStyle} className="tooltip" ref="bad-selection">
        Cette sélection ne vous plait pas&nbsp;?
        <div className="tooltiptext tooltip-bottom" style={tooltipStyle}>
          Nous essayons au maximum de vous faire des propositions
          d'actions utiles mais nous réussissons mieux certains jours
          que d'autres.

          <br /><br />

          Cliquez sur les actions qui ne vous conviennent pas puis sur
          "<strong>Ne pas faire cette action</strong>" en bas à gauche
          de l'écran qui apparaît.

          <br /><br />

          Cela nous permettra d'apprendre à mieux vous aider et
          d'affiner nos recommandations pour la prochaine fois !
        </div>
      </span> : null}
    </div>
  }
}
const Separator = Radium(SeparatorBase)


class FirstDayModal extends React.Component {
  static propTypes = {
    isShown: React.PropTypes.bool,
    onClose: React.PropTypes.func.isRequired,
  }

  render() {
    const {isShown, onClose} = this.props
    return <GamificationModal
        isShown={isShown} onClose={onClose}
        title="Félicitations !"
        imageSrc={require('images/day-1-picto.svg')}
        buttonText="C'est parti">
      Vous venez de créer votre premier projet.
      Nous allons maintenant vous <strong>accompagner au quotidien</strong> pour
      avancer dans votre recherche d'emploi&nbsp;!
    </GamificationModal>
  }
}


class WelcomeBackModal extends React.Component {
  static propTypes = {
    isShown: React.PropTypes.bool,
    onClose: React.PropTypes.func.isRequired,
  }

  render() {
    const {isShown, onClose} = this.props
    return <GamificationModal
        isShown={isShown} onClose={onClose}
        title="Ravi de vous revoir !"
        imageSrc={require('images/jourx-ico.svg')}
        buttonText="Découvrir mon plan d'action">
    Nous sommes là pour vous aider dans la durée.
    Plus vous utilisez Bob Emploi et <strong>plus nous apprendrons</strong> comment vous faire de
    meilleures recommandations&nbsp;!
    </GamificationModal>
  }
}


export {DashboardPage}
