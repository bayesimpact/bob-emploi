import React from 'react'
import {browserHistory} from 'react-router'
import {connect} from 'react-redux'
import moment from 'moment'
moment.locale('fr')
import _ from 'underscore'
import {CircularProgress} from 'components/progress'
import {ShortKey} from 'components/shortkey'

import {declineWholeAdvice} from 'store/actions'
import {getAdviceScorePriority, isAnyAdviceScored} from 'store/advice'
import {genderizeJob} from 'store/job'
import {createProjectTitleComponents, getEmploymentZone, getSeniorityText} from 'store/project'
import {computeBobScore} from 'store/score'
import {getHighestDegreeDescription, getUserFrustrationTags, USER_PROFILE_SHAPE} from 'store/user'
import {NEW_PROJECT_ID, Routes} from 'components/url'

import {PageWithNavigationBar} from 'components/navigation'
import {AdviceCard} from 'components/advisor'
import {Modal} from 'components/modal'
import {JobGroupCoverImage, Colors, Button, GrowingNumber, Icon,
        SmoothTransitions, Styles} from 'components/theme'


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
    params: React.PropTypes.shape({
      projectId: React.PropTypes.string,
    }),
    user: React.PropTypes.object.isRequired,
  }

  state = {
    isSumUpProfileModalShown: false,
    isWaitingInterstitialShown: false,
  }

  componentWillMount() {
    const {params} = this.props
    this.setState({
      isSumUpProfileModalShown: this.props.params.projectId === NEW_PROJECT_ID,
      isWaitingInterstitialShown: this.props.params.projectId === NEW_PROJECT_ID,
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
    const {isWaitingInterstitialShown} = this.state
    const closeSumUpProfileModal = () => this.setState({isSumUpProfileModalShown: false})

    if (isWaitingInterstitialShown || !project.advices) {
      return <WaitingProjectPage
          userProfile={user.profile} style={{flex: 1}} project={project}
          onDone={this.handleWaitingInterstitialDone} />
    }

    return <ProjectDashboardPage
        project={project} onCloseSumUpProfileModal={closeSumUpProfileModal}
        isSumUpProfileModalShown={this.state.isSumUpProfileModalShown} />
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
    hasUnreadTooltipBeenSeen: false,
    isAdviceUselessFeedbackModalShown: false,
    isScoreTooltipShown: false,
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

  toggleScoreTooltip = () => {
    this.setState({isScoreTooltipShown: !this.state.isScoreTooltipShown})
  }

  renderDiagnostic(style) {
    const {profile, project} = this.props
    const {isMobileVersion} = this.context
    const bobScoreStyle = {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: 'solid 1px rgba(255, 255, 255, 0.5)',
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      fontWeight: 'bold',
      margin: 10,
      padding: 20,
      width: 300,
    }
    const {components, percent} = computeBobScore(profile, project)
    return <div style={style}>
      <div style={{display: 'flex', flexDirection: isMobileVersion ? 'column': 'row'}}>
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
        {this.renderDiagnosticComponents(
          components.filter(({category, score}) => Math.round(score) && category === 'market'),
          maybeS => `Facteur${maybeS} lié${maybeS} au marché`)}
        {this.renderDiagnosticComponents(
          components.filter(({category, score}) => Math.round(score) && category === 'user'),
          maybeS => `Information${maybeS} sur votre profil`)}
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
    const {what, experience, where} = createProjectTitleComponents(project, profile.gender)
    return <header style={style}>
      <JobGroupCoverImage
          romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}}
          coverOpacity={1}
          opaqueCoverGradient={{
            left: Colors.CHARCOAL_GREY,
            middle: Colors.CHARCOAL_GREY,
            right: 'rgba(56, 63, 81, 0.7)'}} />

      <div style={{fontSize: 33, fontWeight: 'bold'}}>
        Notre diagnostic
      </div>
      <div style={{fontSize: 23, fontStyle: 'italic'}}>
        <strong>{what} </strong>{experience}<strong> {where}</strong>
      </div>

      {this.renderDiagnostic({marginTop: 15})}
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
    const allAdvices = this.props.project.advices || []
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
    const hasAnyAdviceBeenRead = allAdvices.some(a => a.status !== 'ADVICE_RECOMMENDED')
    return <div key={`advices-${numStars}-star`} style={style}>
      <div style={{margin: 'auto', maxWidth: 960}}>
        <div style={titleLinestyle}>
          <img src={image} style={{marginRight: 20}} />
          {title(advices.length > 1 ? 's' : '')}
        </div>
        <div style={verticalLineStyle} />
        {advices.map(advice => <AdviceCard
            key={advice.adviceId} advice={advice} style={cardStyle}
            onScoreAdvice={this.onScoreAdvice}
            onUnreadTooltipShown={() => this.setState({hasUnreadTooltipBeenSeen: true})}
            isUnreadTooltipForced={
              !hasAnyAdviceBeenRead && !this.state.hasUnreadTooltipBeenSeen &&
              allAdvices.indexOf(advice) === 2}
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


class Gauge extends React.Component {
  static propTypes = {
    halfAngleDeg: React.PropTypes.number.isRequired,
    percent: React.PropTypes.number.isRequired,
    radius: React.PropTypes.number.isRequired,
    scaleY: React.PropTypes.number.isRequired,
    strokeWidth: React.PropTypes.number.isRequired,
    style: React.PropTypes.object,
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
    number: React.PropTypes.number.isRequired,
    style: React.PropTypes.object,
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


export {ProjectPage}
