import React from 'react'
import {browserHistory} from 'react-router'
import {connect} from 'react-redux'

import {deleteUser, displayToasterMessage, setUserProfile, FINISH_PROFILE_SITUATION,
        FINISH_PROFILE_QUALIFICATIONS, FINISH_PROFILE_FRUSTRATIONS, FINISH_PROFILE_CRITERIA,
        ACCEPT_PRIVACY_NOTICE} from 'store/actions'
import {PageWithNavigationBar} from 'components/navigation'
import {Colors, RoundButton, Styles} from 'components/theme'
import {Routes} from 'components/url'
import {Modal, ModalCloseButton, ModalHeader} from 'components/modal'
import {onboardingComplete} from 'store/main_selectors'

import {AccountStep} from './profile/account'
import {GeneralStep} from './profile/general'
import {NoticeStep} from './profile/notice'
import {GeneralSkillsStep} from './profile/general_skills'
import {FrustrationsStep} from './profile/frustrations'
import {FlexibilitiesStep} from './profile/flexibilities'
import {NotificationsStep} from './profile/notifications'

const ONBOARDING_STEPS = [
  {component: NoticeStep, name: 'confidentialite', type: ACCEPT_PRIVACY_NOTICE},
  {component: GeneralStep, name: 'profil', type: FINISH_PROFILE_SITUATION},
  {component: GeneralSkillsStep, name: 'qualifications', type: FINISH_PROFILE_QUALIFICATIONS},
  {component: FrustrationsStep, name: 'frustrations', type: FINISH_PROFILE_FRUSTRATIONS},
  {component: FlexibilitiesStep, name: 'criteres', type: FINISH_PROFILE_CRITERIA},
]

const PAGE_VIEW_STEPS = [
  {component: AccountStep},
  {component: NotificationsStep},
  {component: GeneralStep},
  {component: GeneralSkillsStep},
  {component: FrustrationsStep},
  {component: FlexibilitiesStep},
]


class OnboardingView extends React.Component {
  static propTypes = {
    onChange: React.PropTypes.func.isRequired,
    stepName: React.PropTypes.string,
    userProfile: React.PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props)
  }

  handleSubmit = (userProfileUpdates) => {
    const {stepName, onChange} = this.props
    // TODO(stephan): Build the map name => index once at startup time.
    const currentStepIndex = ONBOARDING_STEPS.findIndex(step => step.name === stepName)
    const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1
    if (!isLastStep) {
      const nextStep = ONBOARDING_STEPS[currentStepIndex + 1]
      browserHistory.push(Routes.PROFILE_PAGE + '/' + nextStep.name)
    }
    onChange(userProfileUpdates, isLastStep, ONBOARDING_STEPS[currentStepIndex].type)
  }

  handleStepBack = (userProfileUpdates) => {
    const {stepName, onChange} = this.props
    const currentStepIndex = ONBOARDING_STEPS.findIndex(step => step.name === stepName)
    if (currentStepIndex > 0) {
      const previousStep = ONBOARDING_STEPS[currentStepIndex - 1]
      // TODO(stephan): Make it go backwards in browser history if possible.
      browserHistory.push(Routes.PROFILE_PAGE + '/' + previousStep.name)
    }
    onChange(userProfileUpdates)
  }

  render() {
    const {stepName, userProfile} = this.props
    if (!stepName) {
      return null
    }
    const currentStepItem = ONBOARDING_STEPS.find(step => step.name === stepName)
    const CurrentStepComponent = currentStepItem && currentStepItem.component
    const currentStepIndex = ONBOARDING_STEPS.findIndex(step => step.name === stepName)
    const nextButtonContent = currentStepIndex === (ONBOARDING_STEPS.length - 1) ?
      'Terminer' : undefined
    const style = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      paddingBottom: 90,
      paddingTop: 90,
    }
    return <div style={style}>
      <CurrentStepComponent
          onSubmit={this.handleSubmit}
          onBack={this.handleStepBack}
          nextButtonContent={currentStepIndex > 0 ? nextButtonContent : null}
          isShownAsStepsDuringOnboarding={true}
          profile={userProfile} />
    </div>
  }
}


class PageView extends React.Component {
  static propTypes = {
    onChange: React.PropTypes.func.isRequired,
    userProfile: React.PropTypes.object.isRequired,
  }

  state = {
    isAccountDeletionModalShown: false,
  }

  render() {
    const {onChange, userProfile} = this.props
    const {isAccountDeletionModalShown} = this.state
    return <div style={{...Styles.CENTERED_COLUMN, paddingBottom: 100}}>
      <AccountDeletionModal
          isShown={isAccountDeletionModalShown}
          onClose={() => this.setState({isAccountDeletionModalShown: false})} />
      {PAGE_VIEW_STEPS.map((step, i) => {
        const StepComponent = step.component
        return <StepComponent
            key={i}
            onSubmit={onChange}
            fastForward={() => {}}
            style={{marginTop: 40}}
            // Hide previous button.
            onPreviousButtonClick={null}
            nextButtonContent="Sauvegarder"
            profile={userProfile} />
      })}
      <div style={{display: 'flex', flexDirection: 'row-reverse', marginTop: 45, width: 945}}>
        <RoundButton
            type="discreet"
            onClick={() => this.setState({isAccountDeletionModalShown: true})}>
          Supprimer mon compte
        </RoundButton>
      </div>
    </div>
  }
}


class ProfilePage extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    location: React.PropTypes.object.isRequired,
    params: React.PropTypes.object.isRequired,
    user: React.PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = {
      isShownAsStepsDuringOnboarding: !onboardingComplete(props.user.profile),
    }
  }

  componentWillMount() {
    const {location} = this.props
    // TODO(stephan): Directly redirect to the step with the missing information.
    if (this.state.isShownAsStepsDuringOnboarding && location.pathname === Routes.PROFILE_PAGE) {
      browserHistory.replace(Routes.PROFILE_PAGE + '/confidentialite')
    }
  }

  handleProfileSave = (userProfileUpdates, isLastStep, actionType) => {
    const {dispatch} = this.props
    dispatch(setUserProfile(userProfileUpdates, true, actionType)).then(() => {
      if (!this.state.isShownAsStepsDuringOnboarding) {
        dispatch(displayToasterMessage('Modifications sauvegardées.'))
      }
    })
    if (isLastStep) {
      if (this.state.isShownAsStepsDuringOnboarding) {
        browserHistory.push(Routes.DASHBOARD_PAGE)
      }
    }
  }

  render() {
    const {params, user} = this.props
    const {isShownAsStepsDuringOnboarding} = this.state
    const style = {
      backgroundColor: Colors.BACKGROUND_GREY,
    }
    return <PageWithNavigationBar style={style} page="profile" isContentScrollable={true}>
      {isShownAsStepsDuringOnboarding ? (
        <OnboardingView
            onChange={this.handleProfileSave}
            stepName={params.stepName}
            userProfile={user.profile} />
      ) :
      <PageView userProfile={user.profile} onChange={this.handleProfileSave} />
      }
    </PageWithNavigationBar>
  }
}


class AccountDeletionModalBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isShown: React.PropTypes.bool,
    onClose: React.PropTypes.func.isRequired,
    user: React.PropTypes.object.isRequired,
  }

  handleDeletionClick = () => {
    const {dispatch, user} = this.props
    dispatch(deleteUser(user)).then(() => {
      dispatch(displayToasterMessage('Votre compte a été définitivement supprimé.'))
      browserHistory.push(Routes.ROOT)
    })
  }

  render() {
    const {isShown, onClose} = this.props
    const contentStyle = {
      color: Colors.CHARCOAL_GREY,
      fontSize: 14,
      lineHeight: 1.6,
      padding: 35,
      width: 700,
    }
    const buttonsBarStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      display: 'flex',
      justifyContent: 'flex-end',
      padding: 13,
    }
    return <Modal isShown={isShown} onClose={onClose}>
      <ModalHeader>Vous voulez nous quitter ? :(</ModalHeader>
      <ModalCloseButton onClick={onClose} closeOnEscape={true} />
      <div style={contentStyle}>
        <p>
          Si vous décidez de supprimer votre compte, toutes vos données personnelles
          seront définitivement effacées, notamment votre profil, vos projets, et vos
          actions effectuées. Il sera ensuite impossible de les récupérer.
        </p>
        <p>
          Nous sommes tristes de vous voir partir, n'hésitez pas à nous dire ce que nous
          pouvons améliorer <a style={{color: Colors.SKY_BLUE}} href="https://airtable.com/shr3pFteo6ERIHnpH">
            en cliquant ici
          </a> !
        </p>
      </div>
      <div style={buttonsBarStyle}>
        <RoundButton
            onClick={onClose}
            style={{marginRight: 13}}
            type="back">
          Annuler
        </RoundButton>
        <RoundButton
            onClick={this.handleDeletionClick}
            type="deletion">
          Supprimer définitivement mon compte
        </RoundButton>
      </div>
    </Modal>
  }
}
const AccountDeletionModal = connect(({user}) => ({user}))(AccountDeletionModalBase)


export {ProfilePage}
