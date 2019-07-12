import _memoize from 'lodash/memoize'
import CheckIcon from 'mdi-react/CheckIcon'
import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, diagnoseOnboarding, displayToasterMessage,
  setUserProfile} from 'store/actions'
import {onboardingComplete} from 'store/main_selectors'
import {USER_PROFILE_FIELDS, isLateSignupEnabled, youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {AccountDeletionModal} from 'components/logout'
import {PageWithNavigationBar} from 'components/navigation'
import {Button, SmoothTransitions, Styles} from 'components/theme'
import {Routes} from 'components/url'

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
  hasAccount?: boolean
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
    const {featuresEnabled, hasAccount, stepName, userProfile} = this.props
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
        profile={userProfile} hasAccount={hasAccount}
        userYou={youForUser({profile: userProfile})} />
    </PageWithNavigationBar>
  }
}
const OnboardingView = withRouter(OnboardingViewBase)


interface PageViewProps {
  dispatch: DispatchAllActions
  featuresEnabled: bayes.bob.Features
  hasAccount?: boolean
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
    hasAccount: PropTypes.bool,
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
    const {featuresEnabled, hasAccount, onChange, userProfile} = this.props
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
          featuresEnabled={featuresEnabled} hasAccount={hasAccount}
          userYou={youForUser({profile: userProfile})} />
      })}
      <div style={deleteContainerStyle}>
        <Button
          type="discreet"
          onClick={this.handleShowAccountDeletionModal(true)}>
          Supprimer {hasAccount ? 'mon compte' : 'mes données'}
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


interface ProfilePageState {
  isShownAsStepsDuringOnboarding: boolean
}


class ProfilePageBase extends React.PureComponent<ProfilePageProps, ProfilePageState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    match: ReactRouterPropTypes.match.isRequired,
    user: PropTypes.object.isRequired,
  }

  public state: ProfilePageState = {
    isShownAsStepsDuringOnboarding: !onboardingComplete(this.props.user),
  }

  private handleProfileSave = (userProfileUpdates, actionType?, shouldNotSaveUser?): void => {
    const {dispatch} = this.props
    dispatch(setUserProfile(userProfileUpdates, !shouldNotSaveUser, actionType)).
      then((success): void => {
        if (success && !this.state.isShownAsStepsDuringOnboarding) {
          dispatch(displayToasterMessage('Modifications sauvegardées.'))
        }
      })
  }

  public render(): React.ReactNode {
    const {dispatch, match: {params: {stepName}, url},
      user: {featuresEnabled, hasAccount, profile}} = this.props
    if (!this.state.isShownAsStepsDuringOnboarding) {
      return <PageWithNavigationBar
        style={{backgroundColor: colors.BACKGROUND_GREY}}
        page="profile" isContentScrollable={true}
        isChatButtonShown={true}>
        <PageView
          userProfile={profile} onChange={this.handleProfileSave} hasAccount={hasAccount}
          featuresEnabled={featuresEnabled} />
      </PageWithNavigationBar>
    }
    if (!stepName) {
      const defaultStepName =
        (profile.gender || isLateSignupEnabled && !hasAccount) ? 'profil' : 'confidentialite'
      return <Redirect to={`${url}/${defaultStepName}`} />
    }
    return <OnboardingView
      dispatch={dispatch}
      onProfileSave={this.handleProfileSave}
      stepName={stepName}
      userProfile={profile}
      featuresEnabled={featuresEnabled}
      hasAccount={hasAccount}
    />
  }
}
export default connect(({user}: RootState): ProfilePageConnectedProps => ({user}))(ProfilePageBase)
