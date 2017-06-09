import React from 'react'
import PropTypes from 'prop-types'
import ReactHeight from 'react-height'
import {browserHistory} from 'react-router'
import {connect} from 'react-redux'
import moment from 'moment'
moment.locale('fr')
import _ from 'underscore'

import config from 'config'

import {allAdvicesReadAction, declineWholeAdvice, modifyProject, setUserProfile,
  shareProductToNetwork} from 'store/actions'
import {genderizeJob} from 'store/job'
import {createProjectTitleComponents, getEmploymentZone, getSeniorityText} from 'store/project'
import {computeBobScore} from 'store/score'
import {getHighestDegreeDescription, getUserFrustrationTags, USER_PROFILE_SHAPE} from 'store/user'
import {ShortKey} from 'components/shortkey'
import {NEW_PROJECT_ID, Routes} from 'components/url'

import bobScoreGrayIcon from 'images/bob-score-grey.svg'
import bobScoreIcon from 'images/bob-score-color.svg'
import emailGrayIcon from 'images/share/email-gray-ico.svg'
import emailIcon from 'images/share/email-ico.svg'
import facebookGrayIcon from 'images/share/facebook-gray-ico.svg'
import facebookIcon from 'images/share/facebook-ico.svg'
import linkedinGrayIcon from 'images/share/linkedin-gray-ico.svg'
import linkedinIcon from 'images/share/linkedin-ico.svg'
import localisationImage from 'images/localisation-picto.svg'
import oneStarImage from 'images/1-star-picto.svg'
import roundUserImage from 'images/round-user-picto.svg'
import threeStarsImage from 'images/3-stars-picto.svg'
import twitterGrayIcon from 'images/share/twitter-gray-ico.svg'
import twitterIcon from 'images/share/twitter-ico.svg'
import twoStarsImage from 'images/2-stars-picto.svg'
import victoryImage from 'images/victory-picto.svg'
import workImage from 'images/work-picto.svg'
import {NAVIGATION_BAR_HEIGHT, PageWithNavigationBar} from 'components/navigation'
import {AdviceCard} from 'components/advisor'
import {Modal} from 'components/modal'
import {JobGroupCoverImage, CircularProgress, Colors, Button, GrowingNumber,
  Icon, LabeledToggle, SmoothTransitions, Styles} from 'components/theme'

const FIXED_EXPLANATION_BAR_HEIGHT = 56


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
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={onClose} />
      <div style={boxStyle}>
        <div style={sectionWithBorderBottom}>
          <img src={roundUserImage} style={pictoStyle} />
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
          <img src={workImage} style={pictoStyle} />
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
          <img src={localisationImage} style={pictoStyle} />
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
      <img src={icon} style={colorIconStyle} />
      <img src={grayIcon} />
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
        <img src={victoryImage} />
      </div>

      <div style={textStyle}>
        Vous avez consulté toutes les propositions que nous avons pour vous à
        ce stade. Nous espérons que certaines vous auront inspiré{maybeE} dans votre
        recherche !

        <br /><br />

        De nouvelles propositions arriverront bientôt&nbsp;! Nous travaillons
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
      browserHistory.replace(Routes.PROJECT_PAGE + '/' + projectId)
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
    image: oneStarImage,
    title: maybeS => `Sujet${maybeS} à regarder`,
  },
  '2': {
    image: twoStarsImage,
    title: maybeS => `Sujet${maybeS} secondaire${maybeS}`,
  },
  '3': {
    image: threeStarsImage,
    title: maybeS => `Sujet${maybeS} prioritaire${maybeS}`,
  },
}


class ProjectDashboardPageBase extends React.Component {
  static propTypes = {
    adviceShownOnMount: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.shape({
      alpha: PropTypes.bool,
    }).isRequired,
    isSumUpProfileModalShown: PropTypes.bool,
    onCloseSumUpProfileModal: PropTypes.func.isRequired,
    profile: USER_PROFILE_SHAPE.isRequired,
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    // This can be either false (e.g. removed), 'hidden' or 'shown'.
    fixedExplanationDisplay: false,
    isAdviceUselessFeedbackModalShown: false,
    isBobScoreShown: false,
    isModifyModalIsShown: false,
    isScoreTooltipShown: false,
    isTheEndModalShown: false,
  }

  componentWillReceiveProps(nextProps) {
    const {advices} = nextProps.project
    const oldAdvices = this.props.project.advices
    const isAdviceUnread = advice => advice.status === 'ADVICE_RECOMMENDED'
    if (advices === oldAdvices || advices.some(isAdviceUnread) ||
        !oldAdvices.some(isAdviceUnread)) {
      return
    }
    clearTimeout(this.readingTimeout)
    this.readingTimeout = setTimeout(() => {
      nextProps.dispatch(allAdvicesReadAction)
      this.setState({isTheEndModalShown: true})
    }, 5000)
  }

  componentDidMount() {
    const {adviceShownOnMount} = this.props
    if (adviceShownOnMount) {
      this.scrollToAdvice(adviceShownOnMount)
    }
  }

  componentWillUnmount() {
    clearTimeout(this.readingTimeout)
  }

  markFeedbackAsUseless = () => {
    const {dispatch, project} = this.props
    const feedback = this.uselessAdviceFeedbackDom && this.uselessAdviceFeedbackDom.value || ''
    dispatch(declineWholeAdvice(project, feedback))
    this.setState({isAdviceUselessFeedbackModalShown: false})
  }

  toggleScoreTooltip = () => {
    this.setState({isScoreTooltipShown: !this.state.isScoreTooltipShown})
  }

  handleScroll = event => {
    const {explanationHeight, fixedExplanationDisplay, headerHeight} = this.state
    if (explanationHeight && headerHeight) {
      const isHeaderAboveTopScroll = event.target.scrollTop >= headerHeight
      const isExplanationAboveTopScroll = isHeaderAboveTopScroll &&
        event.target.scrollTop >= headerHeight + explanationHeight
      const display = isExplanationAboveTopScroll ? 'shown' :
        isHeaderAboveTopScroll ? 'hidden' : false
      if (display !== fixedExplanationDisplay) {
        this.setState({fixedExplanationDisplay: display})
      }
    }
  }

  scrollToUnread = () => {
    const {advices} = this.props.project
    const unreadAdvice = advices.find(advice => advice.status === 'ADVICE_RECOMMENDED')
    if (unreadAdvice) {
      this.scrollToAdvice(unreadAdvice.adviceId)
    }
  }

  scrollToAdvice(adviceId) {
    if (!this.cards  || !this.cards[adviceId] || !this.pageDom) {
      return
    }
    const adviceRect = this.cards[adviceId].getBoundingClientRect()
    this.pageDom.scrollDelta(
      adviceRect.top - NAVIGATION_BAR_HEIGHT - FIXED_EXPLANATION_BAR_HEIGHT - 20)
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
    const onClose = () => this.setState({isBobScoreShown: false})
    const {components, percent} = computeBobScore(profile, project)
    return <div style={containerStyle}>
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={onClose} />
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

      <div style={{backgroundColor: '#fff', color: Colors.DARK_TWO, padding: 10}}>
        {this.renderDiagnosticComponents(
          components.filter(({category, score}) => Math.round(score) && category === 'market'),
          maybeS => `Facteur${maybeS} lié${maybeS} au marché`)}
        {this.renderDiagnosticComponents(
          components.filter(({category, score}) => Math.round(score) && category === 'user'),
          maybeS => `Information${maybeS} sur votre profil`)}

        <div style={{paddingBottom: 30, textAlign: 'center'}}>
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
            <img src={iconSrc} />
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
    const {isMobileVersion} = this.context
    const {featuresEnabled, profile, project} = this.props
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
    const bobScoreButtonStyle = {
      bottom: -35,
      position: 'absolute',
      right: isMobileVersion ? 'calc(50% - 35px)' : 0,
      width: 70,
    }
    const modifyButtonStyle = {
      backgroundColor: 'transparent',
      border: 'solid 2px rgba(255, 255, 255, .4)',
      borderRadius: 2,
      position: 'absolute',
      right: 20,
      top: 20,
    }
    const {what, experience, where} = createProjectTitleComponents(project, profile.gender)
    return <header style={style}>
      <JobGroupCoverImage
          romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
          coverOpacity={1}
          opaqueCoverGradient={{
            left: Colors.CHARCOAL_GREY,
            middle: Colors.CHARCOAL_GREY,
            right: 'rgba(56, 63, 81, 0.7)'}} />
      <div style={{fontSize: 23, fontStyle: 'italic'}}>
        <strong>{what} </strong>{experience}<strong> {where}</strong>
      </div>

      {featuresEnabled.alpha ? <Button
          type="navigationOnImage" isNarrow={true} style={modifyButtonStyle}
          onClick={() => this.setState({isModifyModalIsShown: true})}>
        Modifier mon projet
      </Button> : null}

      <div style={{bottom: 0, left: 0, position: 'absolute', right: 0}}>
        <div style={{margin: 'auto', maxWidth: 960, position: 'relative', textAlign: 'center'}}>
          <BobScoreButton
              style={bobScoreButtonStyle}
              onClick={() => this.setState({isBobScoreShown: true})} />
        </div>
      </div>
    </header>
  }

  renderFixedExplanation() {
    const {fixedExplanationDisplay} = this.state
    if (!fixedExplanationDisplay) {
      // NOTE: We remove it from the DOM so that users can click on buttons
      // underneath when it is completly gone.
      return null
    }
    const advices = this.props.project.advices || []
    const numUnreadAdvices = advices.filter(a => a.status === 'ADVICE_RECOMMENDED').length
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.LIGHT_GREY,
      boxShadow: '0 1px 7px 0 rgba(0, 0, 0, 0.1)',
      color: Colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 16,
      height: FIXED_EXPLANATION_BAR_HEIGHT,
      justifyContent: 'center',
      left: 0,
      opacity: (fixedExplanationDisplay === 'shown' && numUnreadAdvices) ? 1 : 0,
      overflow: 'hidden',
      position: 'fixed',
      right: 14,
      textAlign: 'center',
      top: NAVIGATION_BAR_HEIGHT,
      zIndex: 1,
      ...SmoothTransitions,
    }
    return <div style={style} onClick={this.scrollToUnread}>
      <div>
        <strong style={{fontStyle: 'italic'}}>
          {numUnreadAdvices} proposition{numUnreadAdvices > 1 ? 's' : ''}
        </strong> à regarder
      </div>
    </div>
  }

  renderExplanationSection() {
    const advices = this.props.project.advices || []
    const numUnreadAdvices = advices.filter(a => a.status === 'ADVICE_RECOMMENDED').length
    if (!numUnreadAdvices) {
      return null
    }
    const style = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 26,
      padding: '30px 0 10px',
      textAlign: 'center',
    }
    const hrStyle = {
      backgroundColor: Colors.SILVER,
      border: 'none',
      height: 2,
      margin: '25px auto',
      width: 200,
    }
    return <div style={style}>
      <ReactHeight onHeightReady={explanationHeight => this.setState({explanationHeight})}>
        <div>
          <strong style={{fontStyle: 'italic'}}>
            {numUnreadAdvices} proposition{numUnreadAdvices > 1 ? 's' : ''}
          </strong> à regarder
        </div>
      </ReactHeight>
      <hr style={hrStyle} />
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
          {
            backgroundColor: index % 2 ? Colors.PALE_GREY_TWO : 'transparent',
            paddingTop: index ? 20 : 0,
          },
        )
      )}
    </div>
  }

  renderAdviceCardGroup(numStars, advices, style) {
    const {isMobileVersion} = this.context
    const cardStyle = {
      padding: isMobileVersion ? '15px 10px' : '0 0 25px',
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
    const verticalLineStyle = {
      borderLeft: `solid 2px ${Colors.SILVER}`,
      height: 20,
      marginLeft: 40,
      marginTop: 10,
    }
    const {image, title} = ADVICE_CARD_GROUP_PROPS[numStars] || ADVICE_CARD_GROUP_PROPS['1']
    return <div key={`advices-${numStars}-star`} style={style}>
      <div style={{margin: 'auto', maxWidth: 960}}>
        <div style={titleLinestyle}>
          <img src={image} style={{marginRight: 20}} />
          {title(advices.length > 1 ? 's' : '')}
        </div>
        <div style={verticalLineStyle} />
        {advices.map(advice => <AdviceCard
            key={advice.adviceId} advice={advice} style={cardStyle}
            scrollParent={delta => this.pageDom && this.pageDom.scrollDelta(delta)}
            refDom={card => {
              this.cards = this.cards || {}
              this.cards[advice.adviceId] = card
            }} {...this.props} />
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
            ref={dom => {
              this.uselessAdviceFeedbackDom = dom
            }} />
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
        Aucun conseil ne me convient
      </Button>
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
      <ShortKey keyCode="KeyF" ctrlKey={true} shiftKey={true} onKeyPress={onModify} />
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
    const {isSumUpProfileModalShown, onCloseSumUpProfileModal, profile, project} = this.props
    const {isBobScoreShown, isTheEndModalShown} = this.state
    const advices = project.advices || []
    const isAdviceUseful = advice => advice.status === 'ADVICE_ACCEPTED' || advice.score >= 5
    return <PageWithNavigationBar
        page="project" isContentScrollable={true} ref={dom => {
          this.pageDom = dom
        }} isChatButtonShown={true} onScroll={this.handleScroll}>
      <SumUpProfileModal
          isShown={isSumUpProfileModalShown} project={project} userProfile={profile}
          onClose={() => {
            onCloseSumUpProfileModal()
            this.setState({isBobScoreShown: true})
          }} />
      <TheEndModal
          isShown={isTheEndModalShown}
          onClose={() => this.setState({isTheEndModalShown: false})} />
      <Modal
          style={{backgroundColor: Colors.CHARCOAL_GREY, color: '#fff'}}
          titleStyle={{color: '#fff'}}
          title="Notre diagnostic"
          isShown={isBobScoreShown}
          onClose={() => this.setState({isBobScoreShown: false})}>
        {this.renderDiagnostic()}
      </Modal>
      {this.renderModifyModal()}
      <ReactHeight onHeightReady={headerHeight => this.setState({headerHeight})}>
        {this.renderHeader()}
      </ReactHeight>
      {this.renderExplanationSection()}
      {this.renderFixedExplanation()}
      {this.renderAdviceCards(advices)}
      {advices.some(isAdviceUseful) ? null : this.renderNoAdviceUsefulButton()}
    </PageWithNavigationBar>
  }
}
const ProjectDashboardPage = connect(({user}) => ({
  featuresEnabled: user.featuresEnabled || {},
  profile: user.profile,
}))(ProjectDashboardPageBase)


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


class BobScoreButton extends React.Component {
  static propTypes = {
    style: PropTypes.shape({
      width: PropTypes.number.isRequired,
    }).isRequired,
  }

  state = {
    isHovered: false,
  }

  render() {
    const {style, ...extraProps} = this.props
    const {isHovered} = this.state
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: Colors.DARK_TWO,
      borderRadius: 50,
      boxShadow: '0 3px 5px 0 rgba(0, 0, 0, 0.3)',
      cursor: 'pointer',
      display: 'flex',
      height: style.width,
      justifyContent: 'center',
      position: 'relative',
      transform: `scale(${isHovered ? '1.14' : '1'})`,
      ...style,
    }
    return <div
        style={containerStyle} className="tooltip"
        {...extraProps}
        onMouseEnter={() => this.setState({isHovered: true})}
        onMouseLeave={() => this.setState({isHovered: false})}>
      <div style={{position: 'relative'}}>
        <img src={bobScoreGrayIcon} style={{position: 'absolute'}} />
        <img
            src={bobScoreIcon}
            style={{opacity: isHovered ? 1 : 0, position: 'relative', ...SmoothTransitions}} />
      </div>
      <div
          className="tooltiptext tooltip-bottom"
          style={{fontSize: 13, padding: '10px 13px', width: 180}}>
        Revoir mon diagnostic
      </div>
    </div>
  }
}


export {ProjectPage}
