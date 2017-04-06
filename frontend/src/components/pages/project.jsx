import React from 'react'
import {browserHistory} from 'react-router'
import {connect} from 'react-redux'
import moment from 'moment'
moment.locale('fr')
import _ from 'underscore'
import {CircularProgress} from 'components/progress'
import {ShortKey} from 'components/shortkey'

import {fetchPotentialChantiers, updateProjectChantiers, createActionPlan,
        setProjectProperty, declineWholeAdvice} from 'store/actions'
import {getAdviceScorePriority, isAnyAdviceScored} from 'store/advice'
import {genderizeJob} from 'store/job'
import {createProjectTitleComponents, getEmploymentZone} from 'store/project'
import {getHighestDegreeDescription, getUserFrustrationTags, USER_PROFILE_SHAPE} from 'store/user'
import {Routes} from 'components/url'

import {PageWithNavigationBar} from 'components/navigation'
import {NEW_PROJECT_ID} from './new_project'
import {PotentialChantiersLists} from './project/chantiers'
import {IntensityChangeButton, IntensityModal} from './project/intensity'
import {EditProjectModal} from './project/edit_project'
import {AdviceCard} from 'components/advisor'
import {Modal} from 'components/modal'
import {JobGroupCoverImage, Colors, Button, SmoothTransitions, Styles,
        SettingsButton} from 'components/theme'


// TODO(guillaume): Add all theses to the store.
const seniorityToText = {
  EXPERT: 'plus de 10 ans',
  INTERMEDIARY: 'entre 2 et 5 ans',
  INTERNSHIP: 'stage',
  JUNIOR: 'moins de deux ans',
  SENIOR: 'entre 5 et 10 ans',
  UNKNOWN_PROJECT_SENIORITY: '',
}


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
          Merci {userProfile.name} pour votre patience&nbsp;!<br /><br />
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


class ScoreAdviceConfirmationModal extends React.Component {
  static propTypes = {
    adviceConfirmationModalText: React.PropTypes.string,
    onClose: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
    userProfile: React.PropTypes.object.isRequired,
  }

  render() {
    const {adviceConfirmationModalText, onClose, style, ...extraProps} = this.props
    const containerStyle = {
      alignItems: 'center',
      borderRadius: 5,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      justifyContent: 'center',
      maxWidth: 477,
      padding: '0 20px 40px 20px',
      position: 'relative',
      ...style,
    }
    const starStyle = {
      padding: 20,
    }
    return <Modal {...extraProps} isShown={!!adviceConfirmationModalText} style={containerStyle}
        title={<span>
          Nous avons bien pris en compte que ce sujet
          est <strong>{adviceConfirmationModalText}</strong> pour vous
        </span>}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={onClose} />
      <img src={require('images/circle-star-picto.svg')} style={starStyle} />
      <div style={{padding: '20px 50px 0 50px', textAlign: 'center'}}>
        Pour vous aidez à travailler dessus, nous vous enverons des notifications
        par <strong>email</strong> avec des astuces spécialisés pour ce sujet.
      </div>
      <Button
          type="validation" style={{marginTop: 35}}
          onClick={onClose}>
        Voir les autres sujets
      </Button>
    </Modal>
  }
}


class SumUpProfileModal extends React.Component {
  static propTypes = {
    isShown: React.PropTypes.bool,
    onClose: React.PropTypes.func.isRequired,
    project: React.PropTypes.object.isRequired,
    style: React.PropTypes.object,
    userProfile: React.PropTypes.object.isRequired,
  }


  render() {
    const maybeE = (gender) => gender === 'FEMININE' ? 'e' : ''
    const {onClose, project, style, userProfile, ...extraProps} = this.props
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      maxWidth: 600,
      padding: '0 10px 40px 10px',
      position: 'relative',
      ...style,
    }
    const boxStyle = {
      backgroundColor: '#fff',
      fontSize: 15,
      padding: '20px 40px 0 40px',
      textAlign: 'center',
    }
    const infoStyle = {
      fontWeight: 'bold',
    }
    const sectionStyle = {
      alignItems: 'flex-start',
      display: 'flex',
      margin: 'auto',
      paddingTop: 15,
      textAlign: 'left',
    }
    const sectionWithBorderBottom = {
      ...sectionStyle,
      borderBottom: 'solid 1px',
      borderColor: Colors.MODAL_PROJECT_GREY,
      paddingBottom: 17,
    }
    const pictoStyle = {
      margin: '0 20px',
    }
    const frustrationTagStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      borderRadius: 4,
      color: Colors.CHARCOAL_GREY,
      display: 'inline-block',
      fontSize: 14,
      margin: '2.5px 5px 2.5px 0',
      paddingLeft: 6,
      paddingRight: 6,
      ...Styles.CENTER_FONT_VERTICALLY,
    }

    const frustrationsTags = getUserFrustrationTags(userProfile)
    const highestDegreeDescription = getHighestDegreeDescription(userProfile)

    // TODO(guillaume): Avoid flex when possible.
    return <Modal {...extraProps} style={containerStyle}
        title="Les données retenues pour établir votre diagnostic">
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={onClose} />
      <div style={boxStyle}>
        <div style={sectionWithBorderBottom}>
          <img src={require('images/round-user-picto.svg')} style={pictoStyle} />
          <div style={{flex: 1}}>
            <div>
              Sexe&nbsp;:
              <span style={infoStyle}> {userProfile.gender === 'FEMININE' ? 'femme' : 'homme'}
              </span>
            </div>
            <div>Né{maybeE(userProfile.gender)} en&nbsp;:
              <span style={infoStyle}> {userProfile.yearOfBirth}</span>
            </div>
            {highestDegreeDescription ?
              <div>
                Qualifications&nbsp;:
                  <span style={infoStyle}> {highestDegreeDescription}</span>
              </div> : null}
            <div>
              Expérience&nbsp;: <span style={infoStyle}>{seniorityToText[project.seniority]}</span>
            </div>
            {frustrationsTags.length ? <div>
              Frustrations&nbsp;: {frustrationsTags.map(
                (frustration, index) => <div style={frustrationTagStyle} key={index}>
                  {frustration}</div>)}
            </div> : null}
          </div>
        </div>
        <div style={sectionWithBorderBottom}>
          <img src={require('images/work-picto.svg')} style={pictoStyle} />
          <div style={{flex: 1}}>
            <div>
              Métier&nbsp;:
              <span style={infoStyle}> {genderizeJob(project.targetJob, userProfile.gender)}</span>
            </div>
            <div>
              Secteur&nbsp;:
              <span style={infoStyle}> {project.targetJob.jobGroup.name}</span>
            </div>
          </div>
        </div>
        <div style={sectionStyle}>
          <img src={require('images/localisation-picto.svg')} style={pictoStyle} />
          <div style={{flex: 1}}>
            <div>
              Ville&nbsp;:
              <span style={infoStyle}> {userProfile.city.name}</span>
            </div>
            <div>
              Zone de recherche&nbsp;:
              <span style={infoStyle}> {getEmploymentZone(project.mobility)}</span>
            </div>
          </div>
        </div>
        <Button
            type="validation" style={{marginTop: 35}}
            onClick={onClose}>
          Découvrir mon diagnostic
        </Button>
      </div>
    </Modal>
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
    isSumUpProfileModalShown: false,
    isWaitingInterstitialShown: false,
  }

  componentWillMount() {
    const {params, user} = this.props
    const project = getProjectFromProps(this.props)
    const {projectId} = project
    if (!projectId) {
      this.setState({
        isLoadingPotentialChantiers: true,
        isSumUpProfileModalShown: this.props.params.projectId === NEW_PROJECT_ID,
        isWaitingInterstitialShown: this.props.params.projectId === NEW_PROJECT_ID,
      })
    } else {
      if (projectId !== params.projectId) {
        browserHistory.replace(Routes.PROJECT_PAGE + '/' + projectId)
      }
      this.loadPotentialChantiers(projectId)
    }
    const mightShowChantier = !user.featuresEnabled || !user.featuresEnabled.advisor
    if (mightShowChantier && !Object.keys(project.activatedChantiers || {}).length) {
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
    const closeSumUpProfileModal = () => this.setState({isSumUpProfileModalShown: false})

    const isFirstTime = this.getIsFirstTime()

    if (isWaitingInterstitialShown) {
      return <WaitingProjectPage
          userProfile={user.profile} style={{flex: 1}} project={project}
          onDone={this.handleWaitingInterstitialDone} />
    }

    if (user.featuresEnabled && user.featuresEnabled.advisor) {
      return <ProjectDashboardPage
          project={project} onCloseSumUpProfileModal={closeSumUpProfileModal}
          isSumUpProfileModalShown={this.state.isSumUpProfileModalShown} />
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


const ADVICE_CARD_GROUP_PROPS = {
  '1': {
    image: require('images/1-star-picto.svg'),
    title: maybeS => `Sujet${maybeS} à regarder`,
  },
  '2': {
    image: require('images/2-stars-picto.svg'),
    title: maybeS => `Sujet${maybeS} secondaire${maybeS}`,
  },
  '3': {
    image: require('images/3-stars-picto.svg'),
    title: maybeS => `Sujet${maybeS} prioritaire${maybeS}`,
  },
}


class ProjectDashboardPageBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isSumUpProfileModalShown: React.PropTypes.bool,
    onCloseSumUpProfileModal: React.PropTypes.func.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    adviceConfirmationModalText: null,
    isAdviceUselessFeedbackModalShown: false,
  }

  markFeedbackAsUseless = () => {
    const {dispatch, project} = this.props
    dispatch(declineWholeAdvice(project, this.refs.uselessAdviceFeedback.value))
    this.setState({isAdviceUselessFeedbackModalShown: false})
  }

  onScoreAdvice = (score) => {
    if (!isAnyAdviceScored(this.props.project)) {
      this.setState({adviceConfirmationModalText: getAdviceScorePriority(score)})
    }
    return
  }

  dismissScoreAdviceModal = () => {
    this.setState({adviceConfirmationModalText: null})
  }

  // TODO(guillaume): Move to the store.
  getExperience() {
    const {project} = this.props
    return project.seniority === 'INTERNSHIP' ? '' : <span>
        avec {seniorityToText[project.seniority]} d'expérience
    </span>
  }

  renderHeader() {
    const {profile, project} = this.props
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.CHARCOAL_GREY,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: 140,
      padding: '20px 0',
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
      <div style={{fontSize: 23, fontStyle: 'italic'}}>
        <strong>{what} </strong>{this.getExperience()}<strong> {where}</strong>
      </div>
    </header>
  }

  renderExplanation() {
    const {isMobileVersion} = this.context
    const style = {
      color: Colors.CHARCOAL_GREY,
      margin: isMobileVersion ? 0 : 'auto',
      maxWidth: 960,
      padding: '30px 0px 10px',
      textAlign: 'center',
      width: 'auto',
    }
    return <div style={style}>
      <div style={{fontSize: 26, fontWeight: 'bold'}}>
        Voici selon nous vos priorités pour améliorer vos chances
      </div>
      <div style={{fontSize: 15, fontStyle: 'italic', lineHeight: 1.2}}>
        Cliquez sur chacune de ces priorités et nous vous aiderons concrètement.
      </div>
    </div>
  }

  renderAdviceCards(advices) {
    const {isMobileVersion} = this.context
    const cardsContainerStyle = {
      margin: isMobileVersion ? '10px auto' : '25px auto',
    }
    const adviceGroups = _.groupBy(advices, 'numStars')

    return <div style={cardsContainerStyle}>
      {Object.keys(adviceGroups).sort().reverse().map((numStars, index) =>
        this.renderAdviceCardGroup(
          numStars, adviceGroups[numStars],
          {backgroundColor: index % 2 ? Colors.PALE_GREY_TWO : 'transparent'},
        )
      )}
    </div>
  }

  renderAdviceCardGroup(numStars, advices, style) {
    const {isMobileVersion} = this.context
    const cardStyle = {
      padding: isMobileVersion ? '15px 10px' : '25px 0',
    }
    const titleLinestyle = {
      alignItems: 'center',
      color: Colors.DARK_TWO,
      display: 'flex',
      fontSize: 24,
      fontStyle: 'italic',
      fontWeight: 500,
      height: 60,
      padding: '0 10px',
    }
    const {image, title} = ADVICE_CARD_GROUP_PROPS[numStars] || ADVICE_CARD_GROUP_PROPS['1']
    return <div key={`advices-${numStars}-star`} style={style}>
      <div style={{margin: 'auto', maxWidth: 960}}>
        <div style={titleLinestyle}>
          <img src={image} style={{marginRight: 20}} />
          {title(advices.length > 1 ? 's' : '')}
        </div>
        {advices.map((advice, index) => <AdviceCard
            priority={index + 1} key={advice.adviceId} advice={advice} style={cardStyle}
            onScoreAdvice={this.onScoreAdvice}
            {...this.props} />
        )}
      </div>
    </div>
  }

  renderNoAdviceUsefulButton() {
    const closeModal = () => this.setState({isAdviceUselessFeedbackModalShown: false})
    return <div style={{margin: 50, textAlign: 'center'}}>
      <Modal
          isShown={this.state.isAdviceUselessFeedbackModalShown}
          onClose={closeModal}
          style={{padding: '0 60px', textAlign: 'center'}}
          title="Aucun conseil ne vous convient ?">
        <div style={{fontSize: 14, lineHeight: 1.21, margin: '25px auto 15px', maxWidth: 350}}>
          Nous cherchons à nous améliorer pour vous proposer le meilleur
          service possible. Aidez-nous en nous expliquant pourquoi les conseils
          proposés ne vous sont pas utiles ou en décrivant ce que vous auriez
          aimé trouver ici. Merci d'avance
        </div>
        <textarea
            style={{display: 'block', minHeight: 150, padding: 10, width: '100%'}}
            ref="uselessAdviceFeedback" />
        <div style={{margin: '25px 0 35px'}}>
          <Button type="back" style={{marginRight: 25}} onClick={closeModal}>
            Annuler
          </Button>
          <Button type="deletion" onClick={this.markFeedbackAsUseless}>
            Envoyer
          </Button>
        </div>
      </Modal>
      <Button
          type="back" onClick={() => this.setState({isAdviceUselessFeedbackModalShown: true})}>
        Auncun conseil ne me convient
      </Button>
    </div>
  }

  render() {
    const {isSumUpProfileModalShown, onCloseSumUpProfileModal, profile, project} = this.props
    const {adviceConfirmationModalText} = this.state
    const advices = project.advices || []
    const isAdviceUseful = advice => advice.status === 'ADVICE_ACCEPTED' || advice.score >= 5
    return <PageWithNavigationBar page="project"  isContentScrollable={true}>
      <SumUpProfileModal
          isShown={isSumUpProfileModalShown} project={project} userProfile={profile}
          onClose={onCloseSumUpProfileModal} />
      <ScoreAdviceConfirmationModal
          adviceConfirmationModalText={adviceConfirmationModalText} project={project}
          userProfile={profile} onClose={this.dismissScoreAdviceModal} />
      {this.renderHeader()}
      {this.renderExplanation()}
      {this.renderAdviceCards(advices)}
      {advices.some(isAdviceUseful) ? null : this.renderNoAdviceUsefulButton()}
    </PageWithNavigationBar>
  }
}
const ProjectDashboardPage = connect(({user}) => ({profile: user.profile}))(
  ProjectDashboardPageBase)


export {ProjectPage}
