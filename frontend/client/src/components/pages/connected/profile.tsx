import _memoize from 'lodash/memoize'
import CheckIcon from 'mdi-react/CheckIcon'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, deleteUser, diagnoseOnboarding, displayToasterMessage,
  setUserProfile} from 'store/actions'
import {YouChooser} from 'store/french'
import {onboardingComplete} from 'store/main_selectors'
import {USER_PROFILE_FIELDS, youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {Button, ExternalLink, SmoothTransitions, Styles} from 'components/theme'
import {Routes} from 'components/url'
import {Modal} from 'components/modal'

import {ProfileStepProps} from './profile/step'
import {getProfileOnboardingStep, gotoNextStep, gotoPreviousStep, hasPreviousStep,
  onboardingStepCount} from './profile/onboarding'
import {AccountStep} from './profile/account'
import {FrustrationsStep} from './profile/frustrations'
import {GeneralStep} from './profile/general'
import {NotificationsStep} from './profile/notifications'
import {SettingsStep} from './profile/settings'


const PAGE_VIEW_STEPS: {component: React.ComponentClass<ProfileStepProps>}[] = [
  {component: AccountStep},
  {component: NotificationsStep},
  {component: GeneralStep},
  {component: FrustrationsStep},
  {component: SettingsStep},
]


interface OnboardingViewProps extends RouteComponentProps<{}> {
  dispatch: DispatchAllActions
  featuresEnabled: bayes.bob.Features
  onProfileSave: (profile: bayes.bob.UserProfile, type: string, isLastProjectStep: boolean) => void
  stepName: string
  userProfile: bayes.bob.UserProfile
}


class OnboardingViewBase extends React.PureComponent<OnboardingViewProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.object,
    history: ReactRouterPropTypes.history.isRequired,
    onProfileSave: PropTypes.func.isRequired,
    stepName: PropTypes.string.isRequired,
    userProfile: PropTypes.object.isRequired,
  }

  public componentDidUpdate(prevProps: OnboardingViewProps): void {
    const {stepName} = this.props
    if (stepName !== prevProps.stepName && this.pageRef.current) {
      this.pageRef.current.scrollTo(0)
    }
  }

  private pageRef: React.RefObject<PageWithNavigationBar> = React.createRef()

  private maybeUpdateProfile(stepUpdates: bayes.bob.UserProfile): void {
    const {onProfileSave, stepName} = this.props
    const {isLastProjectStep, type} = getProfileOnboardingStep(stepName)
    const profileUpdates = {}
    // Filter fields of stepUpdates to keep only the ones that are part of the profile.
    for (const field in USER_PROFILE_FIELDS) {
      if (stepUpdates.hasOwnProperty(field)) {
        profileUpdates[field] = stepUpdates[field]
      }
    }
    onProfileSave(profileUpdates, type, isLastProjectStep)
  }

  private handleSubmit = (stepUpdates: bayes.bob.UserProfile): void => {
    const {dispatch, history, stepName} = this.props
    this.maybeUpdateProfile(stepUpdates)
    gotoNextStep(Routes.PROFILE_PAGE, stepName, dispatch, history)
  }

  private handleStepBack = (stepUpdates?: bayes.bob.UserProfile): void => {
    const {history, stepName} = this.props
    this.maybeUpdateProfile(stepUpdates)
    gotoPreviousStep(Routes.PROFILE_PAGE, stepName, history)
  }

  private handleStepChange = (userDiff: bayes.bob.User): void => {
    this.props.dispatch(diagnoseOnboarding(userDiff))
  }

  public render(): React.ReactNode {
    const {featuresEnabled, stepName, userProfile} = this.props
    const {
      component: StepComponent,
      stepNumber,
    } = getProfileOnboardingStep(stepName)
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
      <StepComponent
        onChange={this.handleStepChange}
        onSubmit={this.handleSubmit}
        onBack={isMobileVersion || !canGoBack ? null : this.handleStepBack}
        featuresEnabled={featuresEnabled}
        isShownAsStepsDuringOnboarding={true}
        stepNumber={stepNumber} totalStepCount={onboardingStepCount}
        profile={userProfile}
        userYou={youForUser({profile: userProfile})} />
    </PageWithNavigationBar>
  }
}
const OnboardingView = withRouter(OnboardingViewBase)


interface PageViewProps {
  dispatch: DispatchAllActions
  featuresEnabled: bayes.bob.Features
  onChange: (userProfile: bayes.bob.UserProfile) => void
  userProfile: bayes.bob.UserProfile
}


interface SaveState {
  isActive: boolean
  rank: number
}


interface PageViewState {
  isAccountDeletionModalShown?: boolean
  saves?: SaveState[]
  totalSavesCount?: number
}


class PageViewBase extends React.PureComponent<PageViewProps, PageViewState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.object,
    onChange: PropTypes.func.isRequired,
    userProfile: PropTypes.object.isRequired,
  }

  public state: PageViewState = {
    isAccountDeletionModalShown: false,
    // TODO(cyrille): Move saves management to its own component.
    saves: [],
    totalSavesCount: 0,
  }

  public componentDidUpdate(prevProps, {totalSavesCount: createdSaveIndex}): void {
    if (createdSaveIndex !== this.state.totalSavesCount) {
      this.setActiveSave(createdSaveIndex, true)
      this.savesTimeout.push(
        setTimeout((): void => this.setActiveSave(createdSaveIndex, false), 2000))
    }
  }

  public componentWillUnmount(): void {
    this.savesTimeout.forEach(clearTimeout)
  }

  private savesTimeout: (ReturnType<typeof setTimeout>)[] = []

  private setActiveSave = (rankToSet, setActive): void => {
    this.setState(({saves}): PageViewState => ({
      saves: saves.map(({isActive, rank}): SaveState => ({
        isActive: rank === rankToSet ? setActive : isActive,
        rank,
      })),
    }))
  }

  private onChange = (userDiff: bayes.bob.User): void => {
    this.props.dispatch(diagnoseOnboarding(userDiff)).then((): void =>
      this.setState(({saves, totalSavesCount}): PageViewState => ({
        saves: [...saves, {isActive: false, rank: totalSavesCount}],
        totalSavesCount: totalSavesCount + 1,
      }))
    )
  }

  private getSaveRemover = (n: number): (() => void) => (): void => {
    this.setState(({saves}): PageViewState =>
      ({saves: saves.filter(({rank}): boolean => rank !== n)}))
  }

  private handleShowAccountDeletionModal = _memoize(
    (isAccountDeletionModalShown: boolean): (() => void) =>
      (): void => this.setState({isAccountDeletionModalShown}))

  public render(): React.ReactNode {
    const {featuresEnabled, onChange, userProfile} = this.props
    const {isAccountDeletionModalShown, saves} = this.state
    const deleteContainerStyle: React.CSSProperties = {
      alignSelf: isMobileVersion ? 'center' : 'stretch',
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: 45,
    }
    const getSavedPopUpStyle = (isActive, index): React.CSSProperties => ({
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 10,
      boxShadow: '0 11px 13px 0 rgba(0, 0, 0, 0.1)',
      display: 'flex',
      padding: '15px 20px',
      position: 'fixed',
      right: 0,
      top: 70,
      transform: `translate(${isActive ? '-10px' : '120%'}, ${120 * index}%)`,
      zIndex: 1,
      ...SmoothTransitions,
    })
    const checkIconStyle: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: colors.GREENISH_TEAL,
      borderRadius: '50%',
      display: 'flex',
      height: 30,
      justifyContent: 'center',
      marginRight: 10,
      width: 30,
    }
    return <div style={{...Styles.CENTERED_COLUMN, paddingBottom: 100}}>
      <AccountDeletionModal
        isShown={isAccountDeletionModalShown}
        onClose={this.handleShowAccountDeletionModal(false)} />
      {saves.map(({isActive, rank}, index): React.ReactNode => <div
        key={rank} style={getSavedPopUpStyle(isActive, index)}
        onTransitionEnd={isActive ? null : this.getSaveRemover(rank)} >
        <div style={checkIconStyle}><CheckIcon size={24} style={{color: '#fff'}} /></div>Sauvegardé
      </div>)}
      {PAGE_VIEW_STEPS.map(({component: StepComponent}, i): React.ReactNode => {
        return <StepComponent
          key={i}
          onSubmit={onChange}
          onChange={this.onChange}
          style={{
            backgroundColor: '#fff',
            boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.04)',
            marginTop: 40,
            width: isMobileVersion ? 'initial' : 945,
          }}
          // Hide previous button.
          onPreviousButtonClick={null}
          isShownAsStepsDuringOnboarding={false}
          buttonsOverride={<div />}
          profile={userProfile}
          featuresEnabled={featuresEnabled}
          userYou={youForUser({profile: userProfile})} />
      })}
      <div style={deleteContainerStyle}>
        <Button
          type="discreet"
          onClick={this.handleShowAccountDeletionModal(true)}>
          Supprimer mon compte
        </Button>
      </div>
    </div>
  }
}
const PageView = connect()(PageViewBase)


interface ProfilePageConnectedProps {
  user: bayes.bob.User
}


interface ProfilePageProps
  extends ProfilePageConnectedProps, RouteComponentProps<{stepName: string}> {
  dispatch: DispatchAllActions
}


class ProfilePageBase extends React.PureComponent<ProfilePageProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    match: ReactRouterPropTypes.match.isRequired,
    user: PropTypes.object.isRequired,
  }

  private isShownAsStepsDuringOnboarding(): boolean {
    return !onboardingComplete(this.props.user)
  }

  private handleProfileSave = (userProfileUpdates, actionType?, shouldNotSaveUser?): void => {
    const {dispatch} = this.props
    dispatch(setUserProfile(userProfileUpdates, !shouldNotSaveUser, actionType)).
      then((success): void => {
        if (success && !this.isShownAsStepsDuringOnboarding()) {
          dispatch(displayToasterMessage('Modifications sauvegardées.'))
        }
      })
  }

  public render(): React.ReactNode {
    const {dispatch, match: {params: {stepName}, url}, user} = this.props
    if (!this.isShownAsStepsDuringOnboarding()) {
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
      featuresEnabled={user.featuresEnabled}
    />
  }
}
export default connect(({user}: RootState): ProfilePageConnectedProps => ({user}))(ProfilePageBase)


interface AccountDeletionModalConnectedProps {
  user: bayes.bob.User
  userYou: YouChooser
}


interface AccountDeletionModalProps
  extends AccountDeletionModalConnectedProps, RouteComponentProps<{}> {
  dispatch: DispatchAllActions
  isShown?: boolean
  onClose: () => void
}


class AccountDeletionModalBase extends React.PureComponent<AccountDeletionModalProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: ReactRouterPropTypes.history.isRequired,
    isShown: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private handleDeletionClick = (): void => {
    const {dispatch, history, user, userYou} = this.props
    dispatch(deleteUser(user)).
      then((response): void => {
        if (response) {
          dispatch(displayToasterMessage(
            `${userYou('Ton', 'Votre')} compte a été définitivement supprimé.`))
          history.push(Routes.ROOT)
        }
      })
  }

  public render(): React.ReactNode {
    const {isShown, onClose} = this.props
    const contentStyle = {
      padding: '30px 50px 0',
      width: 700,
    }
    const buttonsBarStyle = {
      display: 'flex',
      justifyContent: 'center',
      padding: '35px 0 50px',
    }
    return <Modal isShown={isShown} onClose={onClose} title="Vous voulez nous quitter&nbsp;? 😢">
      <div style={contentStyle}>
        Si vous décidez de supprimer votre compte, toutes vos données personnelles
        seront définitivement effacées, notamment votre profil, vos projets, et vos
        actions effectuées. Il sera ensuite impossible de les récupérer.
        <br /><br />
        Nous sommes tristes de vous voir partir, n'hésitez pas à nous dire ce que nous
        pouvons améliorer <ExternalLink
          style={{color: colors.BOB_BLUE}} href="https://airtable.com/shr3pFteo6ERIHnpH">
          en cliquant ici
        </ExternalLink>&nbsp;!
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
const AccountDeletionModal = connect(({user}: RootState): AccountDeletionModalConnectedProps => ({
  user,
  userYou: youForUser(user),
}))(withRouter(AccountDeletionModalBase))
