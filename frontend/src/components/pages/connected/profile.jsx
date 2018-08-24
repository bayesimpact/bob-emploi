import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {withRouter} from 'react-router'
import {Redirect} from 'react-router-dom'

import {deleteUser, diagnoseOnboarding, displayToasterMessage, setUserProfile} from 'store/actions'
import {USER_PROFILE_FIELDS, youForUser} from 'store/user'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {Button, Styles} from 'components/theme'
import {Routes} from 'components/url'
import {Modal, ModalCloseButton, ModalHeader} from 'components/modal'
import {onboardingComplete} from 'store/main_selectors'

import {getOnboardingStep, gotoNextStep, gotoPreviousStep, hasPreviousStep,
  onboardingStepCount} from './profile/onboarding'
import {AccountStep} from './profile/account'
import {FrustrationsStep} from './profile/frustrations'
import {GeneralStep} from './profile/general'
import {NotificationsStep} from './profile/notifications'
import {SettingsStep} from './profile/settings'

const PAGE_VIEW_STEPS = [
  {component: AccountStep},
  {component: NotificationsStep},
  {component: GeneralStep},
  {component: FrustrationsStep},
  {component: SettingsStep},
]


class OnboardingViewBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    onProfileSave: PropTypes.func.isRequired,
    stepName: PropTypes.string.isRequired,
    userProfile: PropTypes.object.isRequired,
  }

  componentDidUpdate(prevProps) {
    const {stepName} = this.props
    if (stepName !== prevProps.stepName && this.pageRef.current) {
      this.pageRef.current.scrollTo(0)
    }
  }

  pageRef = React.createRef()

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
    const {dispatch, history, stepName} = this.props
    this.maybeUpdateProfile(stepUpdates)
    gotoNextStep(Routes.PROFILE_PAGE, stepName, dispatch, history)
  }

  handleStepBack = stepUpdates => {
    const {history, stepName} = this.props
    this.maybeUpdateProfile(stepUpdates)
    gotoPreviousStep(Routes.PROFILE_PAGE, stepName, history)
  }

  render() {
    const {dispatch, stepName, userProfile} = this.props
    const {
      component: CurrentStepComponent,
      stepNumber,
    } = getOnboardingStep(Routes.PROFILE_PAGE, stepName)
    const canGoBack = hasPreviousStep(Routes.PROFILE_PAGE, stepName)
    const pageStyle = {
      backgroundColor: '#fff',
      display: 'flex',
    }
    return <PageWithNavigationBar
      style={pageStyle}
      page="profile"
      onBackClick={isMobileVersion && canGoBack ? this.handleStepBack : null}
      ref={this.pageRef}>
      <CurrentStepComponent
        onChange={userDiff => dispatch(diagnoseOnboarding(userDiff))}
        onSubmit={this.handleSubmit}
        onBack={isMobileVersion || !canGoBack ? null : this.handleStepBack}
        isShownAsStepsDuringOnboarding={true}
        stepNumber={stepNumber} totalStepCount={onboardingStepCount}
        profile={userProfile}
        userYou={youForUser({profile: userProfile})} />
    </PageWithNavigationBar>
  }
}
const OnboardingView = withRouter(OnboardingViewBase)


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
    const deleteContainerStyle = {
      alignSelf: isMobileVersion ? 'center' : 'stretch',
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: 45,
    }
    return <div style={{...Styles.CENTERED_COLUMN, paddingBottom: 100}}>
      <AccountDeletionModal
        isShown={isAccountDeletionModalShown}
        onClose={() => this.setState({isAccountDeletionModalShown: false})} />
      {PAGE_VIEW_STEPS.map(({component: StepComponent}, i) => {
        return <StepComponent
          key={i}
          onSubmit={onChange}
          fastForward={() => {}}
          style={{
            backgroundColor: '#fff',
            boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.04)',
            marginTop: 40,
            width: isMobileVersion ? 'initial' : 945,
          }}
          // Hide previous button.
          onPreviousButtonClick={null}
          nextButtonContent="Sauvegarder"
          profile={userProfile}
          featuresEnabled={featuresEnabled}
          userYou={youForUser({profile: userProfile})} />
      })}
      <div style={deleteContainerStyle}>
        <Button
          type="discreet"
          onClick={() => this.setState({isAccountDeletionModalShown: true})}>
          Supprimer mon compte
        </Button>
      </div>
    </div>
  }
}


class ProfilePageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        stepName: PropTypes.string,
      }).isRequired,
    }).isRequired,
    user: PropTypes.object.isRequired,
  }

  state = {
    isShownAsStepsDuringOnboarding: !onboardingComplete(this.props.user),
  }

  handleProfileSave = (userProfileUpdates, actionType, shouldNotSaveUser) => {
    const {dispatch} = this.props
    dispatch(setUserProfile(userProfileUpdates, !shouldNotSaveUser, actionType)).
      then(success => {
        if (success && !this.state.isShownAsStepsDuringOnboarding) {
          dispatch(displayToasterMessage('Modifications sauvegardées.'))
        }
      })
  }

  render() {
    const {dispatch, match: {params: {stepName}, url}, user} = this.props
    const {isShownAsStepsDuringOnboarding} = this.state
    if (!isShownAsStepsDuringOnboarding) {
      return <PageWithNavigationBar
        style={{backgroundColor: colors.BACKGROUND_GREY}}
        page="profile" isContentScrollable={true}
        isChatButtonShown={true}>
        <PageView
          userProfile={user.profile} onChange={this.handleProfileSave}
          featuresEnabled={user.featuresEnabled} />
      </PageWithNavigationBar>
    }
    if (!stepName) {
      return <Redirect to={`${url}/${user.profile.gender ? 'profil' : 'confidentialite'}`} />
    }
    return <OnboardingView
      dispatch={dispatch}
      onProfileSave={this.handleProfileSave}
      stepName={stepName}
      userProfile={user.profile}
    />
  }
}
export default connect(({user}) => ({user}))(ProfilePageBase)


class AccountDeletionModalBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isShown: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
  }

  handleDeletionClick = () => {
    const {dispatch, history, user} = this.props
    dispatch(deleteUser(user)).
      then(() => {
        dispatch(displayToasterMessage('Votre compte a été définitivement supprimé.'))
        history.push(Routes.ROOT)
      }).
      // The error has been notified by the snack bar, just ignore it.
      catch(() => {})
  }

  render() {
    const {isShown, onClose} = this.props
    const contentStyle = {
      color: colors.CHARCOAL_GREY,
      fontSize: 14,
      lineHeight: 1.6,
      padding: 35,
      width: 700,
    }
    const buttonsBarStyle = {
      backgroundColor: colors.BACKGROUND_GREY,
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
          pouvons améliorer <a style={{color: colors.BOB_BLUE}} href="https://airtable.com/shr3pFteo6ERIHnpH">
            en cliquant ici
          </a> !
        </p>
      </div>
      <div style={buttonsBarStyle}>
        <Button onClick={onClose} style={{marginRight: 13}} type="back" isRound={true}>
          Annuler
        </Button>
        <Button onClick={this.handleDeletionClick} type="deletion" isRound={true}>
          Supprimer définitivement mon compte
        </Button>
      </div>
    </Modal>
  }
}
const AccountDeletionModal = connect(({user}) => ({user}))(withRouter(AccountDeletionModalBase))
