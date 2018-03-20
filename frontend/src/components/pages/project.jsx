import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'
import {Redirect, Route, Switch} from 'react-router-dom'

import {diagnosticIsShown, downloadDiagnosticAsPdf, sendNewAdviceIdea} from 'store/actions'
import {youForUser, USER_PROFILE_SHAPE} from 'store/user'

import {FastForward} from 'components/fast_forward'
import {Modal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {JobGroupCoverImage, CircularProgress, Colors, Button,
  FieldSet, RadioGroup, SmoothTransitions, Styles} from 'components/theme'
import {NEW_PROJECT_ID, Routes} from 'components/url'
import victoryImage from 'images/victory-picto.svg'

import {Diagnostic} from './project/diagnostic'
import {Explorer} from './project/explorer'
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

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
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
    const {isMobileVersion} = this.context
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
      color: Colors.DARK_TWO,
      fontSize: 23,
      fontWeight: 500,
    }
    const waitingNoticeStyle = {
      color: Colors.BOB_BLUE,
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


class SuggestAdviceModalBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isShown: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    project: PropTypes.shape({
      projectId: PropTypes.string,
    }).isRequired,
  }

  state = {
    forSituation: '',
    isThankYouShown: false,
    isValidated: false,
    isVolunteeringForMore: undefined,
    numStars: 0,
    text: '',
  }

  fastForward = () => {
    const {forSituation, isThankYouShown, isVolunteeringForMore, numStars, text} = this.state
    if (isThankYouShown) {
      this.props.onClose()
      return
    }
    if (this.isFormComplete()) {
      this.handleSubmit()
    }
    const newState = {}
    if (!forSituation) {
      newState.forSituation = 'ANY_SITUATION'
    }
    if (!isVolunteeringForMore && isVolunteeringForMore !== false) {
      newState.isVolunteeringForMore = false
    }
    if (!numStars) {
      newState.numStars = 2
    }
    if (!text) {
      newState.text = 'Une super idée !'
    }
    this.setState(newState)
  }

  isFormComplete() {
    const {forSituation, isVolunteeringForMore, numStars, text} = this.state
    return forSituation && numStars && text &&
        (isVolunteeringForMore || isVolunteeringForMore === false)
  }

  handleClose = () => {
    this.setState({isValidated: false})
    this.props.onClose()
  }

  handleSubmit() {
    const {dispatch, project} = this.props
    const {forSituation, isVolunteeringForMore, numStars, text} = this.state
    if (!this.isFormComplete()) {
      this.setState({isValidated: true})
      return
    }
    dispatch(sendNewAdviceIdea(project, JSON.stringify({
      forSituation,
      isVolunteeringForMore,
      numStars,
      text,
    })))
    this.setState({
      forSituation: '',
      isThankYouShown: true,
      isValidated: false,
      isVolunteeringForMore: undefined,
      numStars: 0,
      text: '',
    })
  }

  renderForm() {
    const {isShown} = this.props
    const {forSituation, isThankYouShown, isValidated, isVolunteeringForMore,
      numStars, text} = this.state
    const subtitleStyle = {
      borderBottom: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      fontSize: 14,
      marginBottom: 30,
      paddingBottom: 30,
      textAlign: 'center',
    }
    const textareaStyle = {
      height: 140,
      padding: 10,
      width: '100%',
    }
    if (isValidated && !text) {
      textareaStyle.border = `solid 1px ${Colors.RED_PINK}`
    }
    return <Modal
      title="Bob s'améliore grâce à vous"
      {...this.props} onClose={this.handleClose} isShown={isShown && !isThankYouShown}>
      <FastForward onForward={this.fastForward} />
      <div style={{padding: '0 50px 50px'}}>
        <div style={subtitleStyle}>
          Proposez de nouveaux conseils pour aider les chercheurs d'emploi&nbsp;!
        </div>

        <FieldSet
          label="Quel conseil donneriez-vous à quelqu'un dans une situation similaire à la vôtre ?"
          isValid={!!text} isValidated={isValidated}>
          <textarea
            style={textareaStyle}
            placeholder={'Écrivez ici votre idée : un conseil que vous aimeriez ' +
              'avoir reçu, une astuce que vous avez découverte, etc.'} value={text}
            onChange={event => this.setState({text: event.target.value})} />
        </FieldSet>

        <FieldSet
          label="À votre avis, à qui peut-on recommander ce conseil ?"
          isValid={!!forSituation} isValidated={isValidated}>
          <RadioGroup
            options={[
              {name: 'Aux personnes dans la même situation que moi', value: 'SAME_SITUATION'},
              {name: 'À toutes les personnes ayant le même métier que moi', value: 'SAME_JOB'},
              {name: 'À tout le monde', value: 'ANY_SITUATION'},
            ]}
            style={{flexDirection: 'column'}}
            onChange={forSituation => this.setState({forSituation})}
            value={forSituation} />
        </FieldSet>

        <FieldSet
          label="Selon vous, ce conseil est à classer comme :"
          isValid={!!numStars} isValidated={isValidated}>
          <RadioGroup
            options={[
              {name: 'Prioritaire', value: 3},
              {name: 'Secondaire', value: 2},
              {name: 'À regarder', value: 1},
            ]}
            style={{flexDirection: 'column'}}
            onChange={numStars => this.setState({numStars})}
            value={numStars} />
        </FieldSet>

        <FieldSet
          label="Souhaitez-vous faire partie de notre communauté de contributeurs ?"
          isValid={isVolunteeringForMore || isVolunteeringForMore === false}
          isValidated={isValidated}>
          <RadioGroup
            options={[
              {name: 'Non', value: false},
              {name: "Oui, je souhaite participer à l'évolution de Bob", value: true},
            ]}
            style={{justifyContent: 'space-around'}}
            onChange={isVolunteeringForMore => this.setState({isVolunteeringForMore})}
            value={isVolunteeringForMore} />
        </FieldSet>

        <div style={{textAlign: 'center'}}>
          <Button type="validation" onClick={() => this.handleSubmit()} isRound={true}>
            Proposer mon conseil
          </Button>
        </div>
      </div>
    </Modal>
  }

  renderThankYou() {
    const {isShown, onClose, ...extraProps} = this.props
    const {isThankYouShown} = this.state
    return <Modal
      title="Merci beaucoup pour votre aide !" {...extraProps}
      onHidden={() => this.setState({isThankYouShown: false})}
      isShown={isShown && isThankYouShown}>
      <FastForward onForward={onClose} />
      <div style={{fontSize: 15, lineHeight: 1.5, padding: '30px 50px 30px'}}>

        <div style={{marginBottom: 25, textAlign: 'center'}}>
          <img src={victoryImage} alt="" />
        </div>

        <div style={{maxWidth: 380}}>
          Grâce à vous nous allons pouvoir apporter une aide de plus en plus
          personnalisée aux personnes en recherche d'emploi.

          <br /><br />

          Nous analysons votre proposition et reviendrons vers vous si nous avons
          des questions&nbsp;!
        </div>

        <div style={{marginTop: 40, textAlign: 'center'}}>
          <Button onClick={onClose} isRound={true}>
            Revenir aux conseils
          </Button>
        </div>

        <div style={{marginTop: 10, textAlign: 'center'}}>
          <span
            style={{cursor: 'pointer', display: 'inline-block', padding: 10}}
            onClick={() => this.setState({isThankYouShown: false})}>
            Proposer un autre conseil
          </span>
        </div>
      </div>
    </Modal>
  }

  render() {
    return <div>
      {this.renderForm()}
      {this.renderThankYou()}
    </div>
  }
}
const SuggestAdviceModal = connect()(SuggestAdviceModalBase)


class NeedAdviceSelectionModal extends React.Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {onClose, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const style = {
      borderRadius: 10,
      margin: isMobileVersion ? '0 20px' : 'initial',
      padding: isMobileVersion ? '30px 35px' : 50,
    }
    return <Modal onClose={onClose} style={style} {...extraProps}>
      <div style={{maxWidth: 450}}>
        Sélectionnez d'abord des conseils pour pouvoir les consulter en profondeur.
      </div>
      <div style={{marginTop: 20, textAlign: 'center'}}>
        <Button onClick={onClose} isRound={true}>
          OK
        </Button>
      </div>
    </Modal>
  }
}


const DIAGNOSTIC_TAB = 'analyser'
const EXPLORER_TAB = 'explorer'
const WORKBENCH_TAB = 'avancer'


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
    const {location, match, user} = this.props
    const {hash, search} = location
    const {isFirstTime, isWaitingInterstitialShown} = this.state

    if (project.projectId && project.projectId !== match.params.projectId) {
      return <Redirect to={Routes.PROJECT_PAGE + '/' + project.projectId + hash} />
    }

    if (isWaitingInterstitialShown || !project.advices) {
      return <WaitingProjectPage
        userProfile={user.profile} style={{flex: 1}} project={project}
        onDone={this.handleWaitingInterstitialDone} />
    }

    const hasSelectedAdvices = (project.advices || []).some(advice => !!advice.score)
    const defaultTab = isFirstTime ? DIAGNOSTIC_TAB :
      hasSelectedAdvices ? WORKBENCH_TAB : EXPLORER_TAB
    return <Switch>
      <Route path={`${match.url}/:tab`} render={props => <ProjectDashboardPage
        project={project} baseUrl={match.url} {...props} />} />
      <Redirect to={`${match.url}/${defaultTab}${search}${hash}`} />
    </Switch>
  }
}
const ProjectPage = connect(({user}) => ({user}))(ProjectPageBase)


class ProjectDashboardPageBase extends React.Component {
  static propTypes = {
    baseUrl: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.shape({
      poleEmploi: PropTypes.bool,
    }).isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      pathname: PropTypes.string.isRequired,
      search: PropTypes.string.isRequired,
    }).isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        tab: PropTypes.string.isRequired,
      }).isRequired,
      url: PropTypes.string.isRequired,
    }).isRequired,
    notificationsSeen: PropTypes.shape({
      infoCollKit: PropTypes.bool,
    }).isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool,
  }

  state = {
    isNeedAdviceSelectionModalShown: false,
    isPoleEmploiChangelogShown: this.props.featuresEnabled.poleEmploi,
    isSuggestAdviceModalIsShown: false,
  }

  componentWillReceiveProps(nextProps) {
    const {project: {advices}} = nextProps
    const oldAdvices = this.props.project.advices
    const isImportantAdviceUnread = a => a.numStars > 1 && a.status === 'ADVICE_RECOMMENDED'
    if (advices === oldAdvices || advices.some(isImportantAdviceUnread) ||
        !oldAdvices.some(isImportantAdviceUnread)) {
      return
    }
  }

  // The tab that is currently shown: it can be either DIAGNOSTIC_TAB,
  // EXPLORER_TAB, WORKBENCH_TAB or the empty string.
  getTabShown() {
    return this.props.match.params.tab
  }

  hasSelectedAdvices() {
    return (this.props.project.advices || []).some(advice => advice.score)
  }

  scrollTo = element => {
    if (!this.pageDom) {
      this.scrollElementOnReady = element
      return
    }
    const elementRect = element.getBoundingClientRect()
    // Add delta to make sure scroll top appears below the navigation bar.
    const headerDelta = this.context.isMobileVersion ? 90 : 60
    this.pageDom.scrollDelta(elementRect.top - headerDelta)
  }

  maybeShowWorkbench = () => {
    if (this.hasSelectedAdvices()) {
      this.switchToTab(WORKBENCH_TAB)
    } else {
      this.setState({isNeedAdviceSelectionModalShown: true})
    }
  }

  openExplorer = () => this.switchToTab(EXPLORER_TAB)

  renderWorkbenchNotifications = () => {
    const {project: {advices}, userYou} = this.props
    const {isMobileVersion} = this.context
    const numAdviceUnread = (advices || []).
      filter(advice => advice.score && advice.status !== 'ADVICE_READ').length
    const hasAdviceRead = !!(advices || []).some(advice => advice.status === 'ADVICE_READ')
    const isTooltipShown = numAdviceUnread && !hasAdviceRead
    const bubbleStyle = {
      alignItems: 'center',
      backgroundColor: numAdviceUnread ? Colors.GREENISH_TEAL : Colors.COOL_GREY,
      borderRadius: 21,
      color: '#fff',
      display: 'flex',
      fontWeight: 'bold',
      height: 21,
      justifyContent: 'center',
      position: 'relative',
      verticalAlign: 'bottom',
      width: 21,
      ...Styles.CENTER_FONT_VERTICALLY,
      ...SmoothTransitions,
    }
    const tooltipStyle = {
      left: 10,
      position: 'absolute',
      top: '150%',
      transform: isMobileVersion ? 'translateX(-100%)' : 'translateX(-50%)',
      width: isMobileVersion ? 250 : 350,
      zIndex: 1,
    }
    const tooltipNotchStyle = {
      borderBottom: 'solid 15px #fff',
      borderLeft: 'solid 16px transparent',
      borderRight: 'solid 16px transparent',
      display: 'inline-block',
      position: isMobileVersion ? 'absolute' : 'initial',
      right: 10,
    }
    const tooltipBubbleStyle = {
      backgroundColor: '#fff',
      borderRadius: 4,
      boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.3)',
      color: Colors.DARK,
      fontWeight: 'normal',
      padding: '16px 20px',
      textAlign: 'left',
    }
    // TODO(pascal): Display the tooltip differently on mobile when this is visible on mobile.
    return <span style={bubbleStyle}>
      {numAdviceUnread}
      {isTooltipShown ? <div style={tooltipStyle}>
        <div style={{height: 15}}>
          <span style={tooltipNotchStyle} />
        </div>
        <div style={tooltipBubbleStyle}>
          Super, {userYou('tu as', 'vous avez')} sélectionné un premier conseil à
          creuser. {userYou('Tu peux', 'Vous pouvez')} maintenant <strong>cliquer
          ci-dessus</strong> pour découvrir toutes les astuces que nous
          avons préparées pour {userYou('toi', 'vous')} !
        </div>
      </div> : null}
    </span>
  }

  switchToTab = tabName => {
    this.context.history.push(`${this.props.baseUrl}/${tabName}`)
  }

  tabs = [
    {
      name: DIAGNOSTIC_TAB,
      onSelect: () => this.switchToTab(DIAGNOSTIC_TAB),
      subtitle: 'le diagnostic de ma situation',
      title: 'Analyser',
    },
    {
      name: EXPLORER_TAB,
      onSelect: () => this.switchToTab(EXPLORER_TAB),
      subtitle: 'les conseils pour mon projet',
      title: 'Explorer',
    },
    {
      isDisabled: () => !this.hasSelectedAdvices(),
      name: WORKBENCH_TAB,
      notifications: this.renderWorkbenchNotifications,
      onSelect: this.maybeShowWorkbench,
      subtitle: "sur les pistes que j'ai sélectionnées",
      title: 'Avancer',
    },
  ]

  renderNavBarContent() {
    const {isMobileVersion} = this.context
    const tabShown = this.getTabShown()
    const buttonBarStyle = {
      alignSelf: 'stretch',
      backgroundColor: isMobileVersion ? Colors.DARK : 'initial',
      color: Colors.SILVER,
      display: 'flex',
      fontSize: 13,
      justifyContent: 'center',
      // TODO(marielaure): Get rid of these by wrapping the header into a div:
      // https://stackoverflow.com/questions/21030056/border-around-divs-when-viewing-on-mobile-device
      marginBottom: isMobileVersion ? -1 : 'initial',
      marginTop: isMobileVersion ? -1 : 'initial',
    }
    return <div style={buttonBarStyle}>
      {this.tabs.map(({name, isDisabled, onSelect, notifications, subtitle, title}, index) =>
        <HeaderLink key={`tab-${name}`}
          onClick={onSelect}
          isDisabled={isDisabled && isDisabled()}
          isSelected={tabShown === name}
          isFirstLink={!index}
          isNextLinkSelected={this.tabs[index + 1] && this.tabs[index + 1].name === tabShown}
          isShort={window.innerWidth < 2 * 180 + 3 * 230}
          subtitle={subtitle}
          notifications={notifications && notifications()}>
          {title}
        </HeaderLink>
      )}
    </div>
  }

  render() {
    const {baseUrl, featuresEnabled, location, match, notificationsSeen,
      profile, project, userYou} = this.props
    const {hash, search} = location
    const {isNeedAdviceSelectionModalShown, isPoleEmploiChangelogShown,
      isSuggestAdviceModalIsShown} = this.state
    const tabShown = this.getTabShown()
    const isInfoCollKitNotificationShown =
      featuresEnabled.poleEmploi && !notificationsSeen.infoCollKit &&
      tabShown === EXPLORER_TAB

    return <PageWithNavigationBar
      page="project"
      navBarContent={this.renderNavBarContent()}
      isContentScrollable={tabShown !== DIAGNOSTIC_TAB}
      ref={dom => {
        this.pageDom = dom
        if (this.scrollElementOnReady) {
          this.scrollTo(this.scrollElementOnReady)
          this.scrollElementOnReady = null
        }
      }} isChatButtonShown={true} style={{display: 'flex', flexDirection: 'column'}}>
      <PoleEmploiChangelogModal
        isShown={isPoleEmploiChangelogShown} projectCreatedAt={project.createdAt}
        onClose={() => this.setState({isPoleEmploiChangelogShown: false})} />
      <SuggestAdviceModal
        isShown={isSuggestAdviceModalIsShown} project={project}
        onClose={() => this.setState({isSuggestAdviceModalIsShown: false})} />
      <NeedAdviceSelectionModal
        isShown={isNeedAdviceSelectionModalShown}
        onClose={() => this.setState({isNeedAdviceSelectionModalShown: false})} />
      <Switch>
        <Route path={`${baseUrl}/${DIAGNOSTIC_TAB}`} render={() =>
          <DiagnosticTab
            onNextTab={() => this.switchToTab(EXPLORER_TAB)}
            {... {project, userYou}} />
        } />
        <Route path={`${baseUrl}/${EXPLORER_TAB}`} render={() =>
          <Explorer
            onSuggestClick={() => this.setState({isSuggestAdviceModalIsShown: true})}
            onValidateSelection={() => this.switchToTab(WORKBENCH_TAB)} scrollTo={this.scrollTo}
            {...{isInfoCollKitNotificationShown, profile, project,
              userYou}}
          />} />
        <Route path={`${baseUrl}/${WORKBENCH_TAB}/:adviceId?`} render={props =>
          <Workbench {...props} baseUrl={match.url} project={project} style={{flex: 1}} />} />
        {/* Got an unknown tab, redirect to base URL to switch to default tab. */}
        <Redirect to={`${baseUrl}${search}${hash}`} />
      </Switch>
    </PageWithNavigationBar>
  }
}
const ProjectDashboardPage = connect(({user}) => ({
  featuresEnabled: user.featuresEnabled || {},
  notificationsSeen: user.notificationsSeen || {},
  profile: user.profile,
  userYou: youForUser(user),
}))(ProjectDashboardPageBase)


class DiagnosticTabBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onNextTab: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      name: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      diagnostic: PropTypes.object,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {dispatch, onNextTab, profile, project, userYou} = this.props
    const {isMobileVersion} = this.context
    if (!project.diagnostic) {
      return <Redirect to={Routes.APP_UPDATED_PAGE} />
    }
    const diagnosticContainerStyle = {
      backgroundColor: '#fff',
      margin: 'auto',
      maxWidth: 1000,
      minWidth: isMobileVersion ? '100%' : 680,
      padding: '48px 0',
    }
    return <div style={{backgroundColor: '#fff', padding: '0 20px', width: '100%'}}>
      <FastForward onForward={onNextTab} />
      <div style={diagnosticContainerStyle}>
        <Diagnostic
          diagnosticData={project.diagnostic}
          onClose={onNextTab}
          onShown={() => dispatch(diagnosticIsShown(project))}
          onDownloadAsPdf={() => dispatch(downloadDiagnosticAsPdf(project))}
          userName={profile.name}
          userYou={userYou}
        />
      </div>
    </div>
  }
}
const DiagnosticTab = connect(({user}) => ({profile: user.profile || {}}))(DiagnosticTabBase)


class HeaderLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isDisabled: PropTypes.bool,
    isFirstLink: PropTypes.bool,
    isNextLinkSelected: PropTypes.bool,
    isSelected: PropTypes.bool,
    isShort: PropTypes.bool,
    notifications: PropTypes.node,
    style: PropTypes.object,
    // TODO(pascal): Check with john how to add subtitles back.
    // subtitle: PropTypes.node,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isDisabled, isFirstLink, isNextLinkSelected, isSelected, isShort,
      notifications, style, children, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const containerStyle = {
      ':hover': isSelected ? {} : {
        color: isDisabled ? Colors.COOL_GREY : '#fff',
      },
      alignItems: 'center',
      backgroundColor: !isMobileVersion && isSelected ? '#fff' : 'initial',
      color: isSelected ? isMobileVersion ? '#fff' : Colors.DARK :
        isMobileVersion ? Colors.SLATE : Colors.COOL_GREY,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      fontSize: isMobileVersion ? 'inherited' : 16,
      height: isMobileVersion ? 40 : 56,
      justifyContent: 'center',
      minWidth: isMobileVersion ? 100 : isShort ? 140 : 230,
      opacity: isDisabled ? 0.3 : 1,
      position: 'relative',
      zIndex: 1,
      ...SmoothTransitions,
      ...style,
    }
    const notificationsStyle = {
      alignItems: 'center',
      display: 'flex',
      position: 'absolute',
      right: isMobileVersion ? -5 : 15,
    }
    const leftBorderStyle = {
      backgroundColor: isSelected ? '#fff' : Colors.DARK,
      borderBottom: 'solid 28px transparent',
      borderLeft: `solid 10px ${Colors.DARK}`,
      borderTop: 'solid 28px transparent',
      position: 'absolute',
      right: '100%',
      top: 0,
      ...SmoothTransitions,
    }
    const rightBorderStyle = {
      backgroundColor: isNextLinkSelected ? '#fff' : Colors.DARK,
      borderBottom: 'solid 28px transparent',
      borderLeft: `solid 10px ${isSelected ? '#fff' : Colors.DARK}`,
      borderTop: 'solid 28px transparent',
      position: 'absolute',
      right: 0,
      top: 0,
      ...SmoothTransitions,
    }
    return <div
      style={containerStyle}
      {...extraProps}
    >
      <strong style={{textTransform: 'uppercase'}}>{children}</strong>
      {notifications ? <div style={notificationsStyle}>
        {notifications}
      </div> : null}
      {isMobileVersion ? null : <React.Fragment>
        {isFirstLink ? <div style={leftBorderStyle} /> : null}
        <div style={rightBorderStyle} />
      </React.Fragment>}
    </div>
  }
}
const HeaderLink = Radium(HeaderLinkBase)


export {ProjectPage}
