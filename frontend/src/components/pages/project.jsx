import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'
import {browserHistory} from 'react-router'
import {connect} from 'react-redux'
import _ from 'underscore'

import config from 'config'

import {allAdvicesReadAction, bobScoreIsShown, markNotificationAsSeen, modifyProject,
  sendProjectFeedback, setUserProfile, shareProductToNetwork,
  sendNewAdviceIdea} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {maybeContract, lowerFirstLetter} from 'store/french'
import {InfoCollNotificationBox} from 'components/info_coll'
import {genderizeJob} from 'store/job'
import {createProjectTitleComponents, getEmploymentZone, getSeniorityText} from 'store/project'
import {computeBobScore} from 'store/score'
import {getHighestDegreeDescription, getUserFrustrationTags, USER_PROFILE_SHAPE} from 'store/user'
import {ShortKey} from 'components/shortkey'
import {NEW_PROJECT_ID, Routes} from 'components/url'

import emailGrayIcon from 'images/share/email-gray-ico.svg'
import emailIcon from 'images/share/email-ico.svg'
import facebookGrayIcon from 'images/share/facebook-gray-ico.svg'
import facebookIcon from 'images/share/facebook-ico.svg'
import linkedinGrayIcon from 'images/share/linkedin-gray-ico.svg'
import linkedinIcon from 'images/share/linkedin-ico.svg'
import localisationImage from 'images/localisation-picto.svg'
import roundUserImage from 'images/round-user-picto.svg'
import starIcon from 'images/star.svg'
import starOutlineIcon from 'images/star-outline.svg'
import threeStarsBackgroundImage from 'images/3-stars-background.svg'
import threeStarsImage from 'images/3-stars-picto.svg'
import twitterGrayIcon from 'images/share/twitter-gray-ico.svg'
import twitterIcon from 'images/share/twitter-ico.svg'
import twoStarsBackgroundImage from 'images/2-stars-background.svg'
import twoStarsImage from 'images/2-stars-picto.svg'
import victoryImage from 'images/victory-picto.svg'
import workImage from 'images/work-picto.svg'
import {NAVIGATION_BAR_HEIGHT, PageWithNavigationBar} from 'components/navigation'
import {AdviceCard} from 'components/advisor'
import {Modal} from 'components/modal'
import {JobGroupCoverImage, CircularProgress, CheckboxList, Colors, Button,
  FieldSet, GrowingNumber, Icon, LabeledToggle, RadioGroup, SmoothTransitions,
  Styles} from 'components/theme'

import {PoleEmploiChangelogModal} from './project/pole_emploi'


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
      color: Colors.SKY_BLUE,
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 1.5,
    }
    return <div style={containerStyle}>
      <ShortKey keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={onDone} />
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


class SumUpProfileModal extends React.Component {
  static propTypes = {
    isShown: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
    userProfile: PropTypes.object.isRequired,
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
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={onClose} />
      <div style={boxStyle}>
        <div style={sectionWithBorderBottom}>
          <img src={roundUserImage} style={pictoStyle} alt="Profil" />
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
              Expérience&nbsp;: <span style={infoStyle}>
                {getSeniorityText(project.seniority).toLocaleLowerCase()}
              </span>
            </div>
            {frustrationsTags.length ? <div>
              Frustrations&nbsp;: {frustrationsTags.map(
                (frustration, index) => <div style={frustrationTagStyle} key={index}>
                  {frustration}</div>)}
            </div> : null}
          </div>
        </div>
        <div style={sectionWithBorderBottom}>
          <img src={workImage} style={pictoStyle} alt="Métier" />
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
          <img src={localisationImage} style={pictoStyle} alt="Lieu" />
          <div style={{flex: 1}}>
            <div>
              Zone de recherche&nbsp;:
              <span style={infoStyle}> {getEmploymentZone(project.mobility)}</span>
            </div>
          </div>
        </div>
        <Button style={{marginTop: 35}} onClick={onClose}>
          Découvrir mon diagnostic
        </Button>
      </div>
    </Modal>
  }
}


class TheEndModalBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    userProfile: USER_PROFILE_SHAPE.isRequired,
  }

  componentWillMount() {
    this.setState({
      isNewsletterEnabled: !!this.props.userProfile.isNewsletterEnabled,
    })
  }

  handleSubmit = callback => () => {
    const {dispatch, userProfile} = this.props
    const {isNewsletterEnabled} = this.state
    if (isNewsletterEnabled !== !!userProfile.isNewsletterEnabled) {
      dispatch(setUserProfile({...userProfile, isNewsletterEnabled}, true))
    }
    callback()
  }

  share(medium, shareMethod) {
    this.props.dispatch(shareProductToNetwork({medium}))
    shareMethod(
      config.productName,
      `Avec ${config.productName}, un super diagnostic et de bon conseils ` +
      "pour ma recherche d'emploi.",
      'https://www.bob-emploi.fr/')
  }

  renderShareButtons() {
    const style = {
      color: Colors.DARK_TWO,
      fontSize: 14,
      fontStyle: 'italic',
      margin: 30,
      textAlign: 'center',
    }
    const openURL = (base, urlParams, windowParams) => {
      const encodedParams = []
      for (const key in urlParams) {
        encodedParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(urlParams[key] + '')}`)
      }
      window.open(`${base}?${encodedParams.join('&')}`, undefined, windowParams)
    }
    return <div style={style}>
      Si {config.productName} vous a été utile n'hésitez pas à le partager&nbsp;!
      <div style={{marginTop: 15}}>
        {this.renderShareButton(
          'email', emailIcon, emailGrayIcon,
          (subject, body) => openURL('mailto:', {body, subject}))}
        {this.renderShareButton(
          'linkedin', linkedinIcon, linkedinGrayIcon,
          (title, summary, url) => openURL(
            'https://www.linkedin.com/shareArticle',
            {mini: true, summary, title, url},
            'width=550,height=500'))}
        {this.renderShareButton(
          'twitter', twitterIcon, twitterGrayIcon,
          (title, text, url) => openURL(
            'https://twitter.com/share', {text, url}, 'width=500,height=300'))}
        {this.renderShareButton(
          'facebook', facebookIcon, facebookGrayIcon,
          (title, summary, href) => openURL(
            'https://www.facebook.com/dialog/share',
            {'app_id': config.facebookSSOAppId, display: 'popup', href},
            'width=500,height=300'))}
      </div>
    </div>
  }

  renderShareButton(shareId, icon, grayIcon, onShare) {
    const shareIdState = `is${shareId}IconHovered`
    const isHovered = this.state[shareIdState]
    const colorIconStyle = {
      opacity: isHovered ? 1 : 0,
      position: 'absolute',
      ...SmoothTransitions,
    }
    return <span
      style={{cursor: 'pointer', margin: '0 5px', position: 'relative'}}
      onMouseEnter={() => this.setState({[shareIdState]: true})}
      onMouseLeave={() => this.setState({[shareIdState]: false})}
      onClick={() => this.share(shareId, onShare)}>
      <img src={icon} style={colorIconStyle} alt="" />
      <img src={grayIcon} alt={shareId} />
    </span>
  }

  render() {
    const {onClose, userProfile, ...extraProps} = this.props
    const {isNewsletterEnabled} = this.state
    const maybeE = userProfile.gender === 'FEMININE' ? 'e' : ''
    const textStyle = {
      color: Colors.DARK_TWO,
      fontSize: 15,
      lineHeight: 1.5,
      maxWidth: 380,
      padding: '0 50px',
    }
    const hrStyle = {
      backgroundColor: Colors.SILVER,
      border: 'none',
      height: 1,
      margin: '0 50px',
    }
    return <Modal {...extraProps} title="C'est tout pour le moment !">
      <div style={{padding: 25, textAlign: 'center'}}>
        <img src={victoryImage} alt="" />
      </div>

      <div style={textStyle}>
        Vous avez consulté toutes les propositions que nous avons pour vous à
        ce stade. Nous espérons que certaines vous auront inspiré{maybeE} dans votre
        recherche !

        <br /><br />

        De nouvelles propositions arriveront bientôt&nbsp;! Nous travaillons
        dur à améliorer {config.productName}.
      </div>

      <div style={{padding: '30px 50px 0'}}>
        <LabeledToggle
          isSelected={isNewsletterEnabled}
          onClick={() => this.setState({isNewsletterEnabled: !isNewsletterEnabled})}
          label={`Me tenir informé${maybeE} des nouvelles fonctionnalités
              de ${config.productName}`}
          style={{color: Colors.DARK_TWO, fontSize: 13, fontStyle: 'italic'}}
          type="checkbox" />
      </div>

      <div style={{padding: 25, textAlign: 'center'}}>
        <Button onClick={this.handleSubmit(onClose)} type="validation">
          Retourner à mon diagnostic
        </Button>
      </div>

      <hr style={hrStyle} />

      {this.renderShareButtons()}
    </Modal>
  }
}
const TheEndModal = connect(({user}) => ({userProfile: user.profile}))(TheEndModalBase)


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
      <ShortKey keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true}
        onKeyPress={this.fastForward} />
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
          <Button type="validation" onClick={() => this.handleSubmit()}>
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
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={onClose} />
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
          <Button onClick={onClose}>
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


class ProjectPage extends React.Component {
  static propTypes = {
    params: PropTypes.shape({
      projectId: PropTypes.string,
    }),
    routing: PropTypes.shape({
      locationBeforeTransitions: PropTypes.shape({
        hash: PropTypes.string,
      }).isRequired,
    }).isRequired,
    user: PropTypes.object.isRequired,
  }

  state = {
    adviceShownOnMount: null,
    isSumUpProfileModalShown: false,
    isWaitingInterstitialShown: false,
  }

  componentWillMount() {
    const {params, routing} = this.props
    const {hash} = routing.locationBeforeTransitions
    this.setState({
      adviceShownOnMount: hash && hash.substr(1) || null,
      isSumUpProfileModalShown: params.projectId === NEW_PROJECT_ID,
      isWaitingInterstitialShown: params.projectId === NEW_PROJECT_ID,
    })
    const project = getProjectFromProps(this.props)
    const {projectId} = project
    if (projectId && projectId !== params.projectId) {
      browserHistory.replace(Routes.PROJECT_PAGE + '/' + projectId + hash)
    }
  }

  componentWillReceiveProps(nextProps) {
    const {projectId} = getProjectFromProps(nextProps)
    if (!projectId) {
      return
    }
    if (projectId !== nextProps.params.projectId) {
      browserHistory.replace(Routes.PROJECT_PAGE + '/' + projectId)
    }
  }

  handleWaitingInterstitialDone = () => {
    this.setState({isWaitingInterstitialShown: false})
  }

  render() {
    const project = getProjectFromProps(this.props)
    const {user} = this.props
    const {adviceShownOnMount, isSumUpProfileModalShown, isWaitingInterstitialShown} = this.state
    const closeSumUpProfileModal = () => this.setState({isSumUpProfileModalShown: false})

    if (isWaitingInterstitialShown || !project.advices) {
      return <WaitingProjectPage
        userProfile={user.profile} style={{flex: 1}} project={project}
        onDone={this.handleWaitingInterstitialDone} />
    }

    return <ProjectDashboardPage
      project={project} onCloseSumUpProfileModal={closeSumUpProfileModal}
      isSumUpProfileModalShown={isSumUpProfileModalShown}
      adviceShownOnMount={adviceShownOnMount} />
  }
}


const ADVICE_CARD_GROUP_PROPS = {
  '1': {
    title: 'À regarder',
  },
  '2': {
    backgroundImage: twoStarsBackgroundImage,
    image: twoStarsImage,
    title: 'Secondaire',
  },
  '3': {
    backgroundImage: threeStarsBackgroundImage,
    image: threeStarsImage,
    title: 'Prioritaire',
  },
}


class ProjectDashboardPageBase extends React.Component {
  static propTypes = {
    adviceShownOnMount: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.shape({
      poleEmploi: PropTypes.bool,
    }).isRequired,
    isSumUpProfileModalShown: PropTypes.bool,
    notificationsSeen: PropTypes.shape({
      infoCollKit: PropTypes.bool,
    }).isRequired,
    onCloseSumUpProfileModal: PropTypes.func.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    // This can be either false (e.g. removed), 'hidden' or 'shown'.
    isBobScoreShown: false,
    isModifyModalIsShown: false,
    isPoleEmploiChangelogShown: false,
    isScoreTooltipShown: false,
    isSuggestAdviceModalIsShown: false,
    isTheEndModalShown: false,
  }

  componentWillMount() {
    const {poleEmploi} = this.props.featuresEnabled
    this.setState({isPoleEmploiChangelogShown: poleEmploi})
  }

  componentWillReceiveProps(nextProps) {
    const {advices} = nextProps.project
    const oldAdvices = this.props.project.advices
    const isImportantAdviceUnread = a => a.numStars > 1 && a.status === 'ADVICE_RECOMMENDED'
    if (advices === oldAdvices || advices.some(isImportantAdviceUnread) ||
        !oldAdvices.some(isImportantAdviceUnread)) {
      return
    }
    clearTimeout(this.readingTimeout)
    this.readingTimeout = setTimeout(() => {
      nextProps.dispatch(allAdvicesReadAction)
      this.setState({isTheEndModalShown: true})
    }, 5000)
  }

  componentWillUnmount() {
    clearTimeout(this.readingTimeout)
  }

  toggleScoreTooltip = () => {
    this.setState({isScoreTooltipShown: !this.state.isScoreTooltipShown})
  }

  scrollTo = element => {
    if (!this.pageDom) {
      this.scrollElementOnReady = element
      return
    }
    const elementRect = element.getBoundingClientRect()
    this.pageDom.scrollDelta(elementRect.top - 60)
  }

  showBobScore = () => {
    const {dispatch, project} = this.props
    dispatch(bobScoreIsShown(project))
    this.setState({isBobScoreShown: true})
  }

  renderDiagnostic(style) {
    const {profile, project} = this.props
    const {isMobileVersion} = this.context
    const containerStyle = {
      minWidth: isMobileVersion ? '100%' : 680,
      ...style,
    }
    const bobScoreStyle = {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: 'solid 1px rgba(255, 255, 255, 0.5)',
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      fontWeight: 'bold',
      margin: '20px auto',
      padding: 20,
      width: 300,
    }
    const roundedBottom = {borderRadius: '0 0 5px 5px'}
    const onClose = () => this.setState({isBobScoreShown: false})
    const {components, percent} = computeBobScore(profile, project)
    return <div style={containerStyle}>
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={onClose} />
      <div style={bobScoreStyle}>
        <div>Bob Score</div>
        <Gauge percent={percent} style={{margin: 10}} />
        <div style={{fontSize: 17}}>
          <GrowingNumber number={Math.round(percent)} isSteady={true} />%
          <span style={{fontSize: 12}}> de favorabilité</span>
        </div>
        <div
          className={'tooltip' + (this.state.isScoreTooltipShown ? ' forced' : '')}
          style={{fontSize: 13, fontWeight: 'normal'}}>
          <span
            style={{cursor: 'pointer', textDecoration: 'underline'}}
            onClick={this.toggleScoreTooltip}>
            Que veut dire ce score&nbsp;?
          </span>
          <div
            className="tooltiptext"
            style={{padding: '5px 25px', textAlign: 'left', width: 300}}>
            <p>
              Ce score représente notre avis sur la façon dont les facteurs
              liés au marché et à votre recherche affectent vos chances de
              retrouver un emploi. Par exemple, un score proche de 100% indique
              que tous les feux sont au vert&nbsp;!
            </p>

            <p>
              En fonction de vos caractéristiques personnelles vos chances
              individuelles peuvent varier, mais ce score nous donne un point de
              départ pour vous aider.
            </p>
          </div>
        </div>
      </div>

      <div style={{backgroundColor: '#fff', color: Colors.DARK_TWO, padding: 10, ...roundedBottom}}>
        {this.renderDiagnosticComponents(
          components.filter(({category, score}) => Math.round(score) && category === 'market'),
          maybeS => `Facteur${maybeS} lié${maybeS} au marché`)}
        {this.renderDiagnosticComponents(
          components.filter(({category, score}) => Math.round(score) && category === 'user'),
          maybeS => `Information${maybeS} sur votre profil`)}

        <div style={{paddingBottom: 30, textAlign: 'center', ...roundedBottom}}>
          <Button onClick={onClose}>
            Voir les recommandations
          </Button>
        </div>
      </div>
    </div>
  }

  renderDiagnosticComponents(components, title) {
    if (!components.length) {
      return null
    }
    const maybeS = components.length > 1 ? 's' : ''
    const containerStyle = {
      fontSize: 12,
      margin: 10,
      textAlign: 'left',
    }
    const listItemStyle = {
      alignItems: 'center',
      display: 'flex',
      marginTop: 15,
    }
    const iconStyle = {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, .3)',
      borderRadius: 35,
      display: 'flex',
      height: 35,
      justifyContent: 'center',
      marginRight: 12,
      width: 35,
    }
    return <div style={containerStyle}>
      <strong>{title(maybeS)}</strong>
      <ol style={{fontSize: 14, listStyleType: 'none', padding: 0}}>
        {components.map(({display, iconSrc, score, scorePartId}) => <li
          key={scorePartId} style={listItemStyle}>
          <div style={iconStyle}>
            <img src={iconSrc} alt="" />
          </div>
          <div style={{flex: 1}}>
            {display}
            <ArrowsUpOrDown number={Math.round(score)} />
          </div>
        </li>)}
      </ol>
    </div>
  }

  renderHeader() {
    const {profile, project} = this.props
    const {isMobileVersion} = this.context
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.CHARCOAL_GREY,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'relative',
      textAlign: 'center',
      zIndex: 0,
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      fontSize: isMobileVersion ? 23 : 38,
      fontWeight: 'bold',
      marginTop: NAVIGATION_BAR_HEIGHT,
      minHeight: isMobileVersion ? 200 : 240,
      padding: '20px 0',
    }
    const subtitleStyle = {
      color: Colors.MODAL_PROJECT_GREY,
      fontSize: 16,
      fontWeight: 'normal',
      marginTop: 5,
    }
    const buttonBarStyle = {
      alignSelf: 'center',
      color: Colors.SILVER,
      display: 'flex',
      fontSize: 13,
      marginBottom: 10,
    }
    const floatingButtonStyle = {
      bottom: 0,
      boxShadow: '0 2px 2px 0 rgba(0, 0, 0, 0.25)',
      position: 'absolute',
      right: 30,
      transform: 'translateY(50%)',
    }
    const {what, where} = createProjectTitleComponents(project, profile.gender)
    const numAdvices = (project.advices || []).filter(a => a.numStars > 1).length
    const maybeS = numAdvices > 1 ? 's' : ''
    return <header style={style}>
      <JobGroupCoverImage
        romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
        coverOpacity={.6} opaqueCoverColor={Colors.DARK} />
      <div style={titleStyle}>
        <div>
          {numAdvices} conseil{maybeS} personnalisé{maybeS}
          <div style={subtitleStyle}>
            pour trouver un emploi {maybeContract('de ', "d'", what)}
            <strong style={{color: '#fff'}}>
              {lowerFirstLetter(what)} {where}
            </strong>
          </div>
        </div>
      </div>

      <div style={buttonBarStyle}>
        <HeaderLink onClick={this.showBobScore}>
          Revoir mon diagnostic
        </HeaderLink>
        <div style={{borderLeft: 'solid 1px'}} />
        <HeaderLink onClick={() => this.setState({isModifyModalIsShown: true})}>
          Modifier mon projet
        </HeaderLink>
      </div>

      {isMobileVersion ? null : <Button
        style={floatingButtonStyle}
        onClick={() => this.setState({isSuggestAdviceModalIsShown: true})}>
        Proposer un conseil
      </Button>}
    </header>
  }

  renderBottomAdviceSuggest() {
    const style = {
      backgroundColor: Colors.SKY_BLUE,
      boxShadow: '0 1px 7px 0 rgba(0, 0, 0, 0.1)',
      color: '#fff',
      fontSize: 16,
      overflow: 'hidden',
      padding: 10,
    }
    return <div style={style}>
      <div style={{alignItems: 'center', display: 'flex', margin: 'auto', maxWidth: 960}}>
        <span style={{flex: 1, ...Styles.CENTER_FONT_VERTICALLY}}>
          Participez à l'amélioration de Bob en partageant des idées de conseil !
        </span>
        <Button
          type="navigationOnImage"
          onClick={() => this.setState({isSuggestAdviceModalIsShown: true})}>
          Proposer un conseil
        </Button>
      </div>
    </div>
  }

  getClosestAdviceId(adviceId) {
    const {advices} = this.props.project
    if (!advices || !adviceId) {
      return null
    }
    // Exact match.
    if (advices.find(a => a.adviceId === adviceId)) {
      return adviceId
    }
    // Starts with.
    return advices.map(({adviceId}) => adviceId).find(a => a.startsWith(adviceId))
  }

  renderAdviceCards(advices) {
    const {adviceShownOnMount, profile, project} = this.props
    const cardsContainerStyle = {
      margin: '0 auto',
    }
    const adviceGroups = _.groupBy(advices, 'numStars')
    const groupKeys = Object.keys(adviceGroups).sort().reverse()

    const existingAdviceShownOnMount = this.getClosestAdviceId(adviceShownOnMount)

    const sections = []
    groupKeys.forEach((numStars, index) => {
      sections.push(<AdviceSection
        key={`advices-${numStars}-star`}
        numStars={numStars} advices={adviceGroups[numStars]}
        adviceShownOnMount={existingAdviceShownOnMount} scrollTo={this.scrollTo}
        {...{profile, project}} />)
      if (index !== groupKeys.length - 1) {
        // Add separator before next section.
        sections.push(this.renderSectionSeparator(numStars))
      }
    })

    return <div style={cardsContainerStyle}>
      {sections}
    </div>
  }

  renderSectionSeparator(numStars) {
    const {project} = this.props
    const containerStyle = {
      color: '#fff',
      padding: '110px 0',
      position: 'relative',
      zIndex: 0,
    }
    const titleStyle = {
      fontSize: 29,
      fontWeight: 500,
      margin: 'auto',
      maxWidth: 800,
      textAlign: 'center',
    }
    const sourceStyle = {
      bottom: 45,
      fontSize: 16,
      fontStyle: 'italic',
      left: 0,
      position: 'absolute',
      right: 0,
      textAlign: 'center',
    }
    return <div key={`section-sep-${numStars}`} style={containerStyle}>
      <JobGroupCoverImage
        romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
        grayScale={100} blur={2} coverOpacity={.5} opaqueCoverColor={Colors.DARK} />
      <div style={titleStyle}>
        {numStars === '3' ?
          `4 personnes sur 10 retrouvent un emploi grâce
            à leurs contacts, amis, famille, collègues…` :
          `Saviez-vous que seulement 12% des gens retrouvent un emploi
            en répondant à des offres sur internet ?`}
      </div>
      <div style={sourceStyle}>
        Source&nbsp;: <a
          href="http://www.pole-emploi.org/statistiques-analyses/quel-usage-des-outils-numeriques-pour-la-recherche-d-emploi-@/30167/view-article-178066.html"
          style={{color: '#fff'}} target="_blank" rel="noopener noreferrer">
          enquête Pôle emploi / IFOP 2016
        </a>
      </div>
    </div>
  }

  renderModifyModal() {
    const {dispatch, project} = this.props
    const noticeStyle = {
      fontSize: 15,
      fontStyle: 'italic',
      lineHeight: 1.33,
      margin: '35px 0 40px',
      maxWidth: 400,
    }
    const onClose = () => this.setState({isModifyModalIsShown: false})
    const onModify = () => dispatch(modifyProject(project))
    return <Modal
      isShown={this.state.isModifyModalIsShown}
      style={{padding: '0 50px 40px', textAlign: 'center'}}
      title="Modifier mes informations"
      onClose={onClose}>
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={onModify} />
      <div style={noticeStyle}>
        En modifiant votre projet vous perdrez certains éléments de votre diagnostic actuel.
      </div>
      <Button type="back" style={{marginRight: 25}} onClick={onClose}>
        Annuler
      </Button>
      <Button type="validation" onClick={onModify}>
        Continuer
      </Button>
    </Modal>
  }

  render() {
    const {dispatch, featuresEnabled, isSumUpProfileModalShown,
      notificationsSeen, onCloseSumUpProfileModal, profile, project} = this.props
    const {isBobScoreShown, isPoleEmploiChangelogShown,
      isSuggestAdviceModalIsShown, isTheEndModalShown} = this.state
    const {isMobileVersion} = this.context
    const advices = project.advices || []
    const bobScoreStyle = {
      backgroundColor: Colors.CHARCOAL_GREY,
      borderRadius: 5,
      color: '#fff',
      margin: isMobileVersion ? 15 : 'inherit',
    }
    const isInfoCollKitNotificationShown =
      featuresEnabled.poleEmploi && !notificationsSeen.infoCollKit &&
      !isSumUpProfileModalShown && !isBobScoreShown
    return <PageWithNavigationBar
      page="project" isContentScrollable={false} isNavBarTransparent={true} ref={dom => {
        this.pageDom = dom
        if (this.scrollElementOnReady) {
          this.scrollTo(this.scrollElementOnReady)
          this.scrollElementOnReady = null
        }
      }} isChatButtonShown={true}>
      <SumUpProfileModal
        isShown={isSumUpProfileModalShown} project={project} userProfile={profile}
        onClose={() => {
          onCloseSumUpProfileModal()
          this.showBobScore()
        }} />
      <TheEndModal
        isShown={isTheEndModalShown}
        onClose={() => this.setState({isTheEndModalShown: false})} />
      <PoleEmploiChangelogModal
        isShown={isPoleEmploiChangelogShown} projectCreatedAt={project.createdAt}
        onClose={() => this.setState({isPoleEmploiChangelogShown: false})} />
      <Modal
        style={bobScoreStyle}
        titleStyle={{color: '#fff'}}
        title="Notre diagnostic"
        isShown={isBobScoreShown}
        onClose={() => this.setState({isBobScoreShown: false})}>
        {this.renderDiagnostic()}
      </Modal>
      <SuggestAdviceModal
        isShown={isSuggestAdviceModalIsShown} project={project}
        onClose={() => this.setState({isSuggestAdviceModalIsShown: false})} />
      {this.renderModifyModal()}
      {this.renderHeader()}
      {this.renderAdviceCards(advices)}
      <InfoCollNotificationBox
        style={{zIndex: 3}} isShown={isInfoCollKitNotificationShown}
        onClose={() => dispatch(markNotificationAsSeen('infoCollKit'))} />
      <FeedbackBar project={project} style={{padding: '90px 0'}} />
      {this.renderBottomAdviceSuggest()}
    </PageWithNavigationBar>
  }
}
const ProjectDashboardPage = connect(({user}) => ({
  featuresEnabled: user.featuresEnabled || {},
  notificationsSeen: user.notificationsSeen || {},
  profile: user.profile,
}))(ProjectDashboardPageBase)


const feedbackTitle = {
  '1': 'Mauvais',
  '2': 'Peu intéressants',
  '3': 'Intéressants',
  '4': 'Pertinents',
  '5': 'Très pertinents',
}


class FeedbackBarBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isFeminine: PropTypes.bool,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  state = {
    hoveredStars: 0,
    isModalShown: false,
    score: 0,
    text: '',
    usefulAdvices: [],
  }

  saveFeedback = () => {
    const {dispatch, project} = this.props
    const {score, text, usefulAdvices} = this.state
    const usefulAdviceModules = {};
    (usefulAdvices || []).forEach(adviceId => {
      usefulAdviceModules[adviceId] = true
    })
    dispatch(sendProjectFeedback(project, {score, text, usefulAdviceModules}))
  }

  openModal = highlightedStars => {
    const {project} = this.props
    const usefulAdvices = (project.advices || []).
      filter(({score}) => score).
      map(({adviceId}) => adviceId)
    this.setState({isModalShown: true, score: highlightedStars, usefulAdvices})
  }

  renderTitle(numStars) {
    return feedbackTitle[numStars] || 'Que pensez-vous des conseils de Bob ?'
  }

  renderModal() {
    const {isFeminine, project} = this.props
    const {isModalShown, score, usefulAdvices, text} = this.state
    const isGoodFeedback = score > 2
    return <Modal
      isShown={isModalShown} style={{color: Colors.DARK_TWO, padding: 50}}
      onClose={() => this.setState({isModalShown: false, score: 0})}>
      <div style={{borderBottom: `solid 2px ${Colors.SILVER}`, paddingBottom: 35}}>
        {this.renderStars()}
      </div>
      <div style={{fontSize: 15, padding: '35px 0', position: 'relative', width: 600}}>
        <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
          {isGoodFeedback ? <span>
            Qu'est-ce qui vous a le plus parlé dans {config.productName}&nbsp;?
          </span> : <span>
            Pouvez-vous nous dire ce qui n'a pas fonctionné pour vous&nbsp;?
          </span>}
        </div>
        <textarea
          style={{height: 180, padding: 10, width: '100%'}}
          placeholder="Écrivez votre commentaire ici" value={text}
          onChange={event => this.setState({text: event.target.value})} />
        {isGoodFeedback ? <div>
          <div style={{fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>
            Quels conseils vous ont particulièrement intéressé{isFeminine ? 'e' : ''}&nbsp;?
          </div>
          <CheckboxList
            onChange={usefulAdvices => this.setState({usefulAdvices})} values={usefulAdvices}
            options={(project.advices || []).
              filter(a => a.numStars > 1).
              map(advice => ({name: getAdviceTitle(advice), value: advice.adviceId})).
              filter(({name}) => name)} />
        </div> : null}
      </div>
      <div style={{textAlign: 'center'}}>
        <Button type="validation" onClick={this.saveFeedback}>Envoyer</Button>
      </div>
    </Modal>
  }

  renderStars() {
    const {hoveredStars, score} = this.state
    const highlightedStars = hoveredStars || score || 0
    const starStyle = {
      cursor: 'pointer',
      height: 40,
      padding: 5,
    }
    return <div style={{textAlign: 'center'}}>
      <div style={{fontSize: 16, fontWeight: 500, marginBottom: 5}}>
        {this.renderTitle(highlightedStars)}
      </div>
      <div>
        {new Array(5).fill(null).map((unused, index) => <img
          onMouseEnter={() => this.setState({hoveredStars: index + 1})}
          onMouseLeave={() => {
            if (hoveredStars === index + 1) {
              this.setState({hoveredStars: 0})
            }
          }}
          style={starStyle} alt={`${index + 1} étoile${index ? 's' : ''}`}
          onClick={() => this.openModal(highlightedStars)}
          src={(index < highlightedStars) ? starIcon : starOutlineIcon} key={`star-${index}`} />)}
      </div>
    </div>
  }

  render() {
    const {project, style} = this.props
    if (project.feedback && project.feedback.score) {
      return null
    }
    const containerStyle = {
      backgroundColor: Colors.DARK_TWO,
      color: '#fff',
      position: 'relative',
      ...style,
    }
    return <div style={containerStyle}>
      {this.renderModal()}
      {this.renderStars()}
    </div>
  }
}
const FeedbackBar = connect(({user}) => ({
  isFeminine: user.profile.gender === 'FEMININE',
}))(FeedbackBarBase)


class AdviceSection extends React.Component {
  static propTypes = {
    adviceShownOnMount: PropTypes.string,
    advices: PropTypes.arrayOf(PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    numStars: PropTypes.oneOf(Object.keys(ADVICE_CARD_GROUP_PROPS)).isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
    scrollTo: PropTypes.func,
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    const {adviceShownOnMount, advices, numStars} = this.props
    const isCollapsable = advices.length > 1 && numStars === '1'
    const adviceShownIndex =
      isCollapsable && adviceShownOnMount &&
      advices.findIndex(a => a.adviceId === adviceShownOnMount) || 0
    this.setState({
      adviceShownIndex: adviceShownIndex >= 0 ? adviceShownIndex : 0,
      isCollapsable,
      isCollapsed: isCollapsable,
    })
  }

  componentDidMount() {
    const {adviceShownOnMount, scrollTo} = this.props
    if (!adviceShownOnMount || !scrollTo || !this.cards || !this.cards[adviceShownOnMount]) {
      return
    }
    this.mountTimeout = setTimeout(() => scrollTo(this.cards[adviceShownOnMount]), 100)
  }

  componentWillUnmount() {
    clearTimeout(this.mountTimeout)
  }

  handleSeeNextAdvice = () => {
    const {advices} = this.props
    const {adviceShownIndex} = this.state
    this.setState({
      adviceShownIndex: (adviceShownIndex + 1) % advices.length,
    })
    this.seeNextButtonDom && this.seeNextButtonDom.blur()
  }

  renderAdviceCard(advice, style) {
    const {profile, project} = this.props
    return <AdviceCard
      key={advice.adviceId} advice={advice} style={style} maxWidth={960}
      refDom={card => {
        this.cards = this.cards || {}
        this.cards[advice.adviceId] = card
      }} {...{profile, project}} />
  }

  renderCollapsed() {
    const {advices} = this.props
    const {adviceShownIndex} = this.state
    const fakeCardStyle = {
      backgroundColor: '#fff',
      bottom: 0,
      boxShadow: 'rgba(0, 0, 0, 0.25) 0px 2px 10px 0px',
      height: 250,
      left: 'calc(50% - 480px)',
      position: 'absolute',
      width: 960,
    }
    return <div style={{position: 'relative', zIndex: 0}}>
      {this.renderAdviceCard(advices[adviceShownIndex], {padding: '50px 0 60px'})}
      <div
        style={{...fakeCardStyle, transform: 'translate(10px, -55px)', width: 940, zIndex: -1}} />
      <div
        style={{...fakeCardStyle, transform: 'translate(20px, -50px)', width: 920, zIndex: -2}} />
    </div>
  }

  renderCollapseButtons() {
    const {isCollapsed} = this.state
    const buttonStyle = {
      fontSize: 15,
    }
    const expandListStyle = {
      alignItems: 'center',
      bottom: 0,
      color: Colors.COOL_GREY,
      cursor: 'pointer',
      display: 'flex',
      position: 'absolute',
      right: 0,
      top: 0,
    }
    return <div style={{margin: 'auto', maxWidth: 960}}>
      <div style={{minHeight: 24, position: 'relative', textAlign: 'center'}}>
        {isCollapsed ? <Button style={buttonStyle} onClick={this.handleSeeNextAdvice} ref={dom => {
          this.seeNextButtonDom = dom
        }}>
          Voir un autre conseil
        </Button> : null}
        <div style={expandListStyle} onClick={() => this.setState({isCollapsed: !isCollapsed})}>
          <span style={Styles.CENTER_FONT_VERTICALLY}>
            Voir {isCollapsed ? 'la liste complète' : 'moins'}
          </span>
          <Icon
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            style={{fontSize: 20, marginLeft: 10}} />
        </div>
      </div>
    </div>
  }

  render() {
    const {isMobileVersion} = this.context
    const {advices, numStars, style} = this.props
    const {isCollapsable, isCollapsed} = this.state
    if (!advices || !advices.length) {
      return null
    }
    const cardStyle = {
      padding: isMobileVersion ? '15px 10px 40px' : '50px 0',
    }
    const titleLinestyle = {
      color: Colors.DARK_TWO,
      fontSize: 24,
      fontStyle: 'italic',
      fontWeight: 500,
      padding: '25px 10px',
      textAlign: 'center',
    }
    const {backgroundImage, image, title} =
      ADVICE_CARD_GROUP_PROPS[numStars] || ADVICE_CARD_GROUP_PROPS['1']
    const containerStyle = {
      backgroundAttachment: 'fixed',
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'initial',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'contain',
      padding: '45px 0 100px',
      ...style,
    }
    return <div style={containerStyle}>
      <div style={titleLinestyle}>
        {image ? <img src={image} style={{marginBottom: 20}} alt="" /> : null}
        <div>{title}</div>
      </div>
      {isCollapsed ?
        this.renderCollapsed() :
        advices.map(advice => this.renderAdviceCard(advice, cardStyle))}
      {isCollapsable ? this.renderCollapseButtons() : null}
    </div>
  }
}


class Gauge extends React.Component {
  static propTypes = {
    halfAngleDeg: PropTypes.number.isRequired,
    percent: PropTypes.number.isRequired,
    radius: PropTypes.number.isRequired,
    scaleY: PropTypes.number.isRequired,
    strokeWidth: PropTypes.number.isRequired,
    style: PropTypes.object,
  }
  static defaultProps = {
    halfAngleDeg: 60,
    radius: 100,
    scaleY: .8,
    strokeWidth: 40,
  }

  componentWillMount() {
    this.setState({isMounting: true})
    this.timeout = setTimeout(() => this.setState({isMounting: false}), 10)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  renderMark(rad, delta) {
    const {radius, strokeWidth} = this.props
    const style = {
      backgroundColor: '#fff',
      height: strokeWidth,
      left: '50%',
      position: 'absolute',
      top: strokeWidth / 2,
      transform: `rotate(${rad}rad) translate(${delta-2}px, ${-strokeWidth/2}px)`,
      transformOrigin: `0 ${radius}px`,
      width: 4,
    }
    return <div style={style} />
  }

  renderNeedle(rad) {
    const {radius, strokeWidth, style} = this.props
    const needleStyle = {
      backgroundColor: '#fff',
      borderRadius: '50% 50% 2px 2px',
      boxShadow: '1px -8px 5px 0 rgba(0, 0, 0, 0.6)',
      height: strokeWidth / 2 + 5 + radius,
      left: '50%',
      position: 'absolute',
      top: strokeWidth / 2,
      transform: `rotate(${rad}rad) translate(-2px, ${-strokeWidth/2 - 5}px)`,
      transformOrigin: `0 ${radius}px`,
      transition: style.transition || '1000ms',
      width: 4,
    }
    return <div style={needleStyle} />
  }

  render() {
    const {halfAngleDeg, percent, radius, scaleY, style, strokeWidth, ...extraProps} = this.props
    const {isMounting} = this.state
    const squeezedHalfAngle = Math.atan(Math.tan(halfAngleDeg * Math.PI / 180) * scaleY)
    const deltaY = Math.cos(squeezedHalfAngle) * radius
    const halfWidth = Math.sin(squeezedHalfAngle) * radius
    const containerStyle = {
      height: (radius + strokeWidth / 2 + 5) * scaleY,
      width: 2 * (halfWidth + 20),
      ...style,
    }
    const squeezedContainerStyle = {
      position: 'relative',
      transform: `scaleY(${scaleY})`,
    }
    const svgStyle = {
      left: '50%',
      position: 'absolute',
      transform: `translateX(${-20-halfWidth}px)`,
      transformOrigin: '50% 0',
      width: 2 * (20 + halfWidth),
    }
    return <div {...extraProps} style={containerStyle}>
      <div style={squeezedContainerStyle}>
        <svg
          strokeWidth={strokeWidth} style={svgStyle}
          fill="none" viewBox={`-20 0 ${2 * halfWidth + 40} ${deltaY + strokeWidth / 2 + 20}`}>
          <defs>
            <linearGradient
              id="gradient" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={Colors.RED_PINK} />
              <stop offset="50%" stopColor={Colors.SQUASH} />
              <stop offset="100%" stopColor={Colors.GREENISH_TEAL} />
            </linearGradient>
          </defs>
          <g transform={`translate(${halfWidth}, ${strokeWidth / 2 + radius})`}>
            <path
              d={`M ${-halfWidth},-${deltaY} A ${radius},${radius} 0 0,1 ${halfWidth},-${deltaY}`}
              stroke="url(#gradient)" />
          </g>
        </svg>
        {this.renderMark(-squeezedHalfAngle, -4)}
        {this.renderMark(squeezedHalfAngle, 4)}
        {this.renderNeedle(
          -squeezedHalfAngle + (isMounting ? 0 : percent) * 2 * squeezedHalfAngle / 100)}
      </div>
    </div>
  }
}


class ArrowsUpOrDown extends React.Component {
  static propTypes = {
    number: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {number, style, ...extraProps} = this.props
    if (!number) {
      return null
    }
    const containerStyle = {
      color: number > 0 ? Colors.GREENISH_TEAL : Colors.RED_PINK,
      ...style,
    }
    return <div {...extraProps} style={containerStyle}>
      {new Array(Math.abs(number)).fill(null).map((unused, index) => <Icon
        key={index} name={number > 0 ? 'arrow-up' : 'arrow-down'} />)}
    </div>
  }
}


class HeaderLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, style, ...extraProps} = this.props
    const containerStyle = {
      ':hover': {
        color: '#fff',
      },
      cursor: 'pointer',
      fontWeight: 'bold',
      padding: '10px 20px',
      ...SmoothTransitions,
      ...style,
    }
    return <span style={containerStyle} {...extraProps}>
      {children}
    </span>
  }
}
const HeaderLink = Radium(HeaderLinkBase)


export {ProjectPage}
