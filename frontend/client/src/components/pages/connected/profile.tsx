import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useState} from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, diagnoseOnboarding, displayToasterMessage,
  setUserProfile} from 'store/actions'
import {onboardingComplete} from 'store/main_selectors'
import {USER_PROFILE_FIELDS, youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar, Scrollable} from 'components/navigation'
import {RadiumLink} from 'components/radium'
import {SmoothTransitions, Styles, colorToAlpha} from 'components/theme'
import {Routes} from 'components/url'

import {ProfileStepProps} from './profile/step'
import {getProfileOnboardingStep, gotoNextStep, gotoPreviousStep, hasPreviousStep,
  onboardingStepCount} from './profile/onboarding'
import {AccountStep} from './profile/account'
import {FrustrationsStep} from './profile/frustrations'
import {GeneralStep} from './profile/general'
import {PasswordStep} from './profile/password'
import {SettingsStep} from './profile/settings'


const emptyObject = {} as const


interface PageViewStep {
  readonly component: React.ComponentType<ProfileStepProps>
  readonly fragment: string
}

const PAGE_VIEW_STEPS: readonly PageViewStep[] = [
  {
    component: AccountStep,
    fragment: 'compte',
  },
  {
    component: PasswordStep,
    fragment: 'securite',
  },
  {
    component: SettingsStep,
    fragment: 'notifications',
  },
  {
    component: GeneralStep,
    fragment: 'infos',
  },
  {
    component: FrustrationsStep,
    fragment: 'infos',
  },
]


interface PageViewTab {
  fragment: string
  predicate?: (user: bayes.bob.User) => boolean
  title: (user?: bayes.bob.User) => string
}

interface UserPageViewTab {
  fragment: string
  title: string
}

const PAGE_VIEW_TABS: readonly PageViewTab[] = [
  {
    fragment: 'compte',
    title: ({hasAccount}: bayes.bob.User): string => hasAccount ? 'Compte' : 'Nom',
  },
  {
    fragment: 'securite',
    // TODO(cyrille): Prepare this page for users without an email and/or an account.
    predicate: ({hasAccount, profile: {email} = {}}: bayes.bob.User): boolean =>
      !hasAccount || !!email,
    title: ({hasAccount}: bayes.bob.User): string => hasAccount ?
      'Mot de passe' : 'Créer un compte',
  },
  {
    fragment: 'notifications',
    title: (): string => 'Notifications et coaching',
  },
  {
    fragment: 'infos',
    title: (): string => 'Profil',
  },
]


interface OnboardingViewProps extends RouteComponentProps<{}> {
  dispatch: DispatchAllActions
  featuresEnabled?: bayes.bob.Features
  hasAccount?: boolean
  onProfileSave: (profile: bayes.bob.UserProfile, type: string, isLastProjectStep: boolean) => void
  stepName: string
  userProfile?: bayes.bob.UserProfile
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

  private pageRef: React.RefObject<Scrollable> = React.createRef()

  private maybeUpdateProfile(stepUpdates?: bayes.bob.UserProfile): void {
    const {onProfileSave, stepName} = this.props
    const {isLastProjectStep, type} = getProfileOnboardingStep(stepName) || {}
    if (!type) {
      return
    }
    const profileUpdates = {}
    // Filter fields of stepUpdates to keep only the ones that are part of the profile.
    for (const field in USER_PROFILE_FIELDS) {
      if (stepUpdates && Object.prototype.hasOwnProperty.call(stepUpdates, field)) {
        profileUpdates[field] = stepUpdates[field]
      }
    }
    onProfileSave(profileUpdates, type, !!isLastProjectStep)
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
    } = getProfileOnboardingStep(stepName) || {}
    if (!StepComponent) {
      return <Redirect to={Routes.PROFILE_PAGE} />
    }
    const canGoBack = hasPreviousStep(Routes.PROFILE_PAGE, stepName)
    const pageStyle = {
      backgroundColor: '#fff',
      display: 'flex',
    }
    return <PageWithNavigationBar
      style={pageStyle}
      page="profile"
      onBackClick={isMobileVersion && canGoBack ? this.handleStepBack : undefined}
      ref={this.pageRef}>
      <StepComponent
        onChange={this.handleStepChange}
        onSubmit={this.handleSubmit}
        onBack={isMobileVersion || !canGoBack ? undefined : this.handleStepBack}
        featuresEnabled={featuresEnabled || emptyObject}
        isShownAsStepsDuringOnboarding={true}
        stepNumber={stepNumber} totalStepCount={onboardingStepCount}
        profile={userProfile || emptyObject} hasAccount={hasAccount}
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
  stepName?: string
  tabs: UserPageViewTab[]
  userProfile: bayes.bob.UserProfile
}


interface SaveState {
  isActive: boolean
  rank: number
}


interface PageViewState {
  saves: SaveState[]
  totalSavesCount: number
}


interface TabsProps {
  stepName?: string
  style?: React.CSSProperties
  tabs: UserPageViewTab[]
}
const tabStyle = (isSelected: boolean): RadiumCSSProperties => ({
  ':hover': isSelected ? {} : {backgroundColor: colorToAlpha(colors.BOB_BLUE, .1)},
  alignItems: 'center',
  ...isSelected && {backgroundColor: colors.BOB_BLUE},
  borderRadius: 10,
  color: isSelected ? '#fff' : 'inherit',
  display: 'flex',
  height: 50,
  margin: 5,
  padding: '0 20px',
  textDecoration: 'none',
})
const TabListBase: React.FC<TabsProps> = (props: TabsProps): React.ReactElement => {
  const {stepName, style, tabs} = props
  const tabsStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 10,
    boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.1)',
    padding: 25,
    ...style,
  }
  return <div style={tabsStyle}>
    {tabs.map(({fragment, title}) => <RadiumLink
      key={fragment} style={tabStyle(fragment === stepName)}
      to={`${Routes.PROFILE_PAGE}/${fragment}`}>
      {title}
    </RadiumLink>)}
  </div>
}
const TabList = React.memo(TabListBase)


class PageViewBase extends React.PureComponent<PageViewProps, PageViewState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.object,
    hasAccount: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    stepName: PropTypes.string,
    userProfile: PropTypes.object.isRequired,
  }

  public state: PageViewState = {
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
    this.setState(({saves}: PageViewState): Pick<PageViewState, 'saves'> => ({
      saves: saves.map(({isActive, rank}): SaveState => ({
        isActive: rank === rankToSet ? setActive : isActive,
        rank,
      })),
    }))
  }

  private onChange = (userDiff: bayes.bob.User): void => {
    this.props.dispatch(diagnoseOnboarding(userDiff)).then((): void =>
      this.setState(({saves, totalSavesCount}: PageViewState): PageViewState => ({
        saves: [...saves, {isActive: false, rank: totalSavesCount}],
        totalSavesCount: totalSavesCount + 1,
      }))
    )
  }

  private getSaveRemover = (n: number): (() => void) => (): void => {
    this.setState(({saves}: PageViewState): Pick<PageViewState, 'saves'> => ({
      saves: saves.filter(({rank}): boolean => rank !== n),
    }))
  }

  public render(): React.ReactNode {
    const {featuresEnabled, hasAccount, onChange, stepName, tabs, userProfile} = this.props
    if (isMobileVersion && stepName) {
      // No tabs on mobile.
      return <Redirect to={Routes.PROFILE_PAGE} />
    }
    const stepsToShow = stepName ?
      PAGE_VIEW_STEPS.filter(({fragment}): boolean => fragment === stepName) : PAGE_VIEW_STEPS
    if (!stepsToShow.length) {
      // We're lost, go back to root page.
      return <Redirect to={Routes.PROFILE_PAGE} />
    }
    const {title} = tabs.find(({fragment}) => fragment === stepName) || {}
    if (!isMobileVersion && !(stepName && title)) {
      // We have no tab title to show, go to first tab.
      const firstTab = tabs[0].fragment
      return <Redirect to={`${Routes.PROFILE_PAGE}/${firstTab}`} />
    }
    const {saves} = this.state
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
    const tabStyle = {
      backgroundColor: '#fff',
      borderRadius: 10,
      boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.1)',
      padding: isMobileVersion ? 30 : 40,
      width: isMobileVersion ? 'initial' : 600,
    }
    const stepStyle = {
      ...isMobileVersion && tabStyle,
      display: 'block',
      marginTop: isMobileVersion ? 40 : 0,
    }
    const contentStyle = {
      alignItems: 'flex-start',
      marginTop: 0,
      padding: 0,
    }
    return <div style={{...Styles.CENTERED_COLUMN, paddingBottom: 100}}>
      {saves.map(({isActive, rank}, index): React.ReactNode => <div
        key={rank} style={getSavedPopUpStyle(isActive, index)}
        onTransitionEnd={isActive ? undefined : this.getSaveRemover(rank)} >
        <div style={checkIconStyle}><CheckIcon size={24} style={{color: '#fff'}} /></div>Sauvegardé
      </div>)}
      <div style={{alignItems: 'flex-start', display: 'flex', margin: '40px 20px 0'}}>
        {isMobileVersion ? null :
          <TabList tabs={tabs} stepName={stepName} style={{marginRight: 40, minWidth: 360}} />}
        <div style={isMobileVersion ? {marginTop: -40} : tabStyle}>
          {isMobileVersion ? null : <h3 style={{margin: '0 0 30px'}}>{title}</h3>}
          {stepsToShow.map(({component: StepComponent}, index): React.ReactNode => {
            return <StepComponent
              // Override title on desktop.
              {...isMobileVersion ? {} : {title: ''}}
              key={index}
              onSubmit={onChange}
              onChange={this.onChange}
              contentStyle={contentStyle}
              style={stepStyle}
              // Hide previous button.
              onPreviousButtonClick={null}
              isShownAsStepsDuringOnboarding={false}
              buttonsOverride={<div />}
              profile={userProfile}
              featuresEnabled={featuresEnabled} hasAccount={hasAccount}
              userYou={youForUser({profile: userProfile})} />
          })}
        </div>
      </div>
    </div>
  }
}
const PageView = connect(({user}: RootState): {tabs: UserPageViewTab[]} => ({
  tabs: PAGE_VIEW_TABS.
    filter(({predicate}): boolean => !predicate || predicate(user)).
    map(({fragment, title}) => ({fragment, title: title(user)})),
}))(PageViewBase)


interface ProfilePageConnectedProps {
  user: bayes.bob.User
}


interface ProfilePageProps
  extends ProfilePageConnectedProps, RouteComponentProps<{stepName: string}> {
  dispatch: DispatchAllActions
}

const ProfilePageBase: React.FC<ProfilePageProps> = (props): React.ReactElement => {
  const {dispatch, match: {params: {stepName}, url},
    user, user: {featuresEnabled, hasAccount, profile}} = props
  const [isShownAsStepsDuringOnboarding, setShownAsStepsDuringOnboarding] =
    useState(!onboardingComplete(user))
  useEffect((): void => {
    if (isShownAsStepsDuringOnboarding || onboardingComplete(user)) {
      return
    }
    setShownAsStepsDuringOnboarding(true)
  }, [isShownAsStepsDuringOnboarding, user])
  const handleProfileSave = useCallback(
    (userProfileUpdates, actionType?, shouldNotSaveUser?): void => {
      dispatch(setUserProfile(userProfileUpdates, !shouldNotSaveUser, actionType)).
        then((success): void => {
          if (success && !isShownAsStepsDuringOnboarding) {
            dispatch(displayToasterMessage('Modifications sauvegardées.'))
          }
        })
    }, [dispatch, isShownAsStepsDuringOnboarding])
  if (!isShownAsStepsDuringOnboarding) {
    return <PageWithNavigationBar
      style={{backgroundColor: colors.BACKGROUND_GREY}}
      page="profile" isContentScrollable={true}
      isChatButtonShown={true}>
      <PageView
        userProfile={profile || emptyObject} stepName={stepName} onChange={handleProfileSave}
        hasAccount={hasAccount} featuresEnabled={featuresEnabled || emptyObject} />
    </PageWithNavigationBar>
  }
  if (!stepName) {
    const defaultStepName =
      (profile && profile.gender || !hasAccount) ? 'profil' : 'confidentialite'
    return <Redirect to={`${url}/${defaultStepName}`} />
  }
  return <OnboardingView
    dispatch={dispatch}
    onProfileSave={handleProfileSave}
    stepName={stepName}
    userProfile={profile}
    featuresEnabled={featuresEnabled}
    hasAccount={hasAccount}
  />
}
ProfilePageBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  match: ReactRouterPropTypes.match.isRequired,
  user: PropTypes.object.isRequired,
}
export default connect(({user}: RootState): ProfilePageConnectedProps => ({
  user,
}))(ProfilePageBase)
