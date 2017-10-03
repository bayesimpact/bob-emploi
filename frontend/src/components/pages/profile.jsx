import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'

import {deleteUser, displayToasterMessage, setUserProfile} from 'store/actions'
import {USER_PROFILE_FIELDS} from 'store/user'
import {PageWithNavigationBar} from 'components/navigation'
import {Colors, Button, Styles} from 'components/theme'
import {Routes} from 'components/url'
import {Modal, ModalCloseButton, ModalHeader} from 'components/modal'
import {onboardingComplete} from 'store/main_selectors'

import {getOnboardingStep, gotoNextStep, gotoPreviousStep,
  onboardingStepCount} from './profile/onboarding'
import {AccountStep} from './profile/account'
import {GeneralStep} from './profile/general'
import {FrustrationsStep} from './profile/frustrations'
import {NotificationsStep} from './profile/notifications'

const PAGE_VIEW_STEPS = [
  {component: AccountStep},
  {component: NotificationsStep},
  {component: GeneralStep},
  {component: FrustrationsStep},
]


class OnboardingView extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onNewPage: PropTypes.func.isRequired,
    onProfileSave: PropTypes.func.isRequired,
    stepName: PropTypes.string,
    userProfile: PropTypes.object.isRequired,
  }
  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool.isRequired,
  }

  componentWillReceiveProps(nextProps) {
    const {onNewPage, stepName} = nextProps
    if (stepName !== this.props.stepName) {
      onNewPage()
    }
  }

  maybeUpdateProfile(stepUpdates) {
    const {onProfileSave, stepName} = this.props
    const {isLastProjectStep, type} = getOnboardingStep(Routes.PROFILE_PAGE, stepName)
    const profileUpdates = {}
    // Filter fields of stepUpdates to keep only the ones that are part of the profile.
    for (const field in USER_PROFILE_FIELDS) {
      if (stepUpdates.hasOwnProperty(field)) {
        profileUpdates[field] = stepUpdates[field]
      }
    }
    onProfileSave(profileUpdates, type, isLastProjectStep)
  }

  handleSubmit = stepUpdates => {
    const {dispatch, stepName} = this.props
    this.maybeUpdateProfile(stepUpdates)
    gotoNextStep(Routes.PROFILE_PAGE, stepName, dispatch, this.context.history)
  }

  handleStepBack = stepUpdates => {
    this.maybeUpdateProfile(stepUpdates)
    gotoPreviousStep(Routes.PROFILE_PAGE, this.props.stepName, this.context.history)
  }

  render() {
    const {stepName, userProfile} = this.props
    const {isMobileVersion} = this.context
    if (!stepName) {
      return null
    }
    const currentStepItem = getOnboardingStep(Routes.PROFILE_PAGE, stepName)
    const CurrentStepComponent = currentStepItem.component
    const style = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      paddingBottom: isMobileVersion ? 0 : 70,
      paddingTop: isMobileVersion ? 0 : 70,
    }
    return <div style={style}>
      <CurrentStepComponent
        onSubmit={this.handleSubmit} onBack={this.handleStepBack}
        isShownAsStepsDuringOnboarding={true}
        stepNumber={currentStepItem.stepNumber} totalStepCount={onboardingStepCount}
        profile={userProfile} />
    </div>
  }
}


class PageView extends React.Component {
  static propTypes = {
    featuresEnabled: PropTypes.object,
    onChange: PropTypes.func.isRequired,
    userProfile: PropTypes.object.isRequired,
  }

  state = {
    isAccountDeletionModalShown: false,
  }

  render() {
    const {featuresEnabled, onChange, userProfile} = this.props
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
          profile={userProfile}
          featuresEnabled={featuresEnabled} />
      })}
      <div style={{display: 'flex', flexDirection: 'row-reverse', marginTop: 45, width: '100%'}}>
        <Button
          type="discreet"
          onClick={() => this.setState({isAccountDeletionModalShown: true})}>
          Supprimer mon compte
        </Button>
      </div>
    </div>
  }
}


class ProfilePage extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        stepName: PropTypes.string,
      }).isRequired,
    }).isRequired,
    user: PropTypes.object.isRequired,
  }
  static contextTypes = {
    history: PropTypes.shape({
      replace: PropTypes.func.isRequired,
    }).isRequired,
  }

  componentWillMount() {
    const {match, user} = this.props
    const isShownAsStepsDuringOnboarding = !onboardingComplete(user)
    this.setState({isShownAsStepsDuringOnboarding})
    if (isShownAsStepsDuringOnboarding && !match.params.stepName) {
      const stepName = user.profile.gender ? 'profil' : 'confidentialite'
      this.context.history.replace(`${Routes.PROFILE_PAGE}/${stepName}`)
    }
  }

  handleProfileSave = (userProfileUpdates, actionType, shouldNotSaveUser) => {
    const {dispatch} = this.props
    dispatch(setUserProfile(userProfileUpdates, !shouldNotSaveUser, actionType)).then(() => {
      if (!this.state.isShownAsStepsDuringOnboarding) {
        dispatch(displayToasterMessage('Modifications sauvegardées.'))
      }
    })
  }

  render() {
    const {dispatch, match, user} = this.props
    const {isShownAsStepsDuringOnboarding} = this.state
    const style = {
      backgroundColor: Colors.BACKGROUND_GREY,
    }
    return <PageWithNavigationBar
      style={style} page="profile" isContentScrollable={true}
      ref={page => {
        this.page = page
      }}
      isChatButtonShown={!isShownAsStepsDuringOnboarding}>
      {isShownAsStepsDuringOnboarding ? (
        <OnboardingView
          dispatch={dispatch}
          onProfileSave={this.handleProfileSave}
          onNewPage={() => this.page && this.page.scrollTo(0)}
          stepName={match.params.stepName}
          userProfile={user.profile} />
      ) : <PageView
        userProfile={user.profile} onChange={this.handleProfileSave}
        featuresEnabled={user.featuresEnabled} />
      }
    </PageWithNavigationBar>
  }
}


class AccountDeletionModalBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isShown: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
  }
  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
  }

  handleDeletionClick = () => {
    const {dispatch, user} = this.props
    dispatch(deleteUser(user)).then(() => {
      dispatch(displayToasterMessage('Votre compte a été définitivement supprimé.'))
      this.context.history.push(Routes.ROOT)
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
      <ModalCloseButton onClick={onClose} shouldCloseOnEscape={true} />
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
        <Button
          onClick={onClose}
          style={{marginRight: 13}}
          type="back">
          Annuler
        </Button>
        <Button
          onClick={this.handleDeletionClick}
          type="deletion">
          Supprimer définitivement mon compte
        </Button>
      </div>
    </Modal>
  }
}
const AccountDeletionModal = connect(({user}) => ({user}))(AccountDeletionModalBase)


export {ProfilePage}
