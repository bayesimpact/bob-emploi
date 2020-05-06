import {TFunction} from 'i18next'
import _pick from 'lodash/pick'
import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {connect, useDispatch} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Redirect} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, diagnoseOnboarding, displayToasterMessage,
  setUserProfile} from 'store/actions'
import {onboardingComplete} from 'store/main_selectors'
import {useSafeDispatch} from 'store/promise'
import {USER_PROFILE_FIELDS} from 'store/user'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar, Scrollable} from 'components/navigation'
import {RadiumLink} from 'components/radium'
import {SmoothTransitions, Styles, colorToAlpha} from 'components/theme'
import {Routes} from 'components/url'

import {ProfileStepProps} from './profile/step'
import {useProfileOnboarding} from './profile/onboarding'
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
  predicate?: (hasAccount: boolean, profile: bayes.bob.UserProfile) => boolean
  title: (hasAccount: boolean, profile: bayes.bob.UserProfile, t: TFunction) => string
}

interface UserPageViewTab {
  fragment: string
  title: string
}

const PAGE_VIEW_TABS: readonly PageViewTab[] = [
  {
    fragment: 'compte',
    title: (unusedAccount, unusedProfile, t: TFunction): string => t('Profil'),
  },
  {
    fragment: 'securite',
    // TODO(cyrille): Prepare this page for users without an email and/or an account.
    predicate: (hasAccount: boolean, {email}: bayes.bob.UserProfile): boolean =>
      !hasAccount || !!email,
    title: (hasAccount: boolean, profile: bayes.bob.UserProfile, t: TFunction): string =>
      hasAccount ? t('Mot de passe') : t('Créer un compte'),
  },
  {
    fragment: 'notifications',
    title: (unusedAccount, unusedProfile, t: TFunction): string => t('Notifications et coaching'),
  },
]


interface OnboardingViewProps {
  featuresEnabled?: bayes.bob.Features
  hasAccount?: boolean
  onProfileSave: (profile: bayes.bob.UserProfile, type: string, isLastProjectStep: boolean) => void
  stepName: string
  userProfile?: bayes.bob.UserProfile
}


const OnboardingViewBase = (props: OnboardingViewProps): React.ReactElement => {
  const {featuresEnabled, hasAccount, onProfileSave, stepName, userProfile} = props
  const {t} = useTranslation()
  const dispatch = useDispatch<DispatchAllActions>()
  const pageRef = useRef<Scrollable>(null)

  useEffect((): void => pageRef.current?.scrollTo(0), [stepName])

  const {goBack, goNext, step, stepCount} = useProfileOnboarding(stepName)

  const maybeUpdateProfile = useCallback((stepUpdates?: bayes.bob.UserProfile): void => {
    const {isLastProjectStep, type} = step || {}
    if (!type) {
      return
    }
    // Filter fields of stepUpdates to keep only the ones that are part of the profile.
    const profileUpdates: bayes.bob.UserProfile = _pick(stepUpdates, USER_PROFILE_FIELDS)
    onProfileSave(profileUpdates, type, !!isLastProjectStep)
  }, [onProfileSave, step])

  const handleSubmit = useCallback((stepUpdates: bayes.bob.UserProfile): void => {
    maybeUpdateProfile(stepUpdates)
    goNext()
  }, [maybeUpdateProfile, goNext])

  const handleStepBack = useCallback((stepUpdates?: bayes.bob.UserProfile): void => {
    maybeUpdateProfile(stepUpdates)
    goBack?.()
  }, [goBack, maybeUpdateProfile])

  const handleStepChange = useCallback((userDiff: bayes.bob.User): void => {
    dispatch(diagnoseOnboarding(userDiff))
  }, [dispatch])

  const {
    component: StepComponent,
    stepNumber,
  } = step || {}
  if (!StepComponent) {
    return <Redirect to={Routes.PROFILE_PAGE} />
  }
  const pageStyle = {
    backgroundColor: '#fff',
    display: 'flex',
  }
  return <PageWithNavigationBar
    style={pageStyle}
    page="profile"
    onBackClick={isMobileVersion && goBack ? handleStepBack : undefined}
    ref={pageRef}>
    <StepComponent
      onChange={handleStepChange}
      onSubmit={handleSubmit}
      onBack={!isMobileVersion && goBack ? handleStepBack : undefined}
      featuresEnabled={featuresEnabled || emptyObject}
      isShownAsStepsDuringOnboarding={true}
      stepNumber={stepNumber} totalStepCount={stepCount}
      profile={userProfile || emptyObject} hasAccount={hasAccount} t={t} />
  </PageWithNavigationBar>
}
OnboardingViewBase.propTypes = {
  featuresEnabled: PropTypes.object,
  onProfileSave: PropTypes.func.isRequired,
  stepName: PropTypes.string.isRequired,
  userProfile: PropTypes.object.isRequired,
}
const OnboardingView = React.memo(OnboardingViewBase)


interface PageViewProps {
  featuresEnabled: bayes.bob.Features
  hasAccount?: boolean
  onChange: (userProfile: bayes.bob.UserProfile) => void
  stepName?: string
  userProfile: bayes.bob.UserProfile
}


interface SaveState {
  isActive: boolean
  rank: number
}


interface TabsProps {
  stepName?: string
  style?: React.CSSProperties
  tabs: readonly UserPageViewTab[]
}
const tabStyle = (isSelected: boolean): RadiumCSSProperties => ({
  ':hover': isSelected ? {} : {backgroundColor: colorToAlpha(colors.BOB_BLUE, .1)},
  'alignItems': 'center',
  ...isSelected && {backgroundColor: colors.BOB_BLUE},
  'borderRadius': 10,
  'color': isSelected ? '#fff' : 'inherit',
  'display': 'flex',
  'height': 50,
  'margin': 5,
  'padding': '0 20px',
  'textDecoration': 'none',
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


interface SaveNotificationProps extends SaveState {
  index: number
  onRemove: (rank: number) => void
}


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
const getSavedPopUpStyle = (isActive: boolean, index: number): React.CSSProperties => ({
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


const SaveNotificationBase = (props: SaveNotificationProps): React.ReactElement => {
  const {index, isActive, onRemove, rank} = props
  const handleTransitionHand = useCallback((): void => onRemove(rank), [onRemove, rank])
  return <div
    style={getSavedPopUpStyle(isActive, index)}
    onTransitionEnd={isActive ? undefined : handleTransitionHand}>
    <div style={checkIconStyle}><CheckIcon size={24} style={{color: '#fff'}} /></div>
    <Trans parent={null}>Sauvegardé</Trans>
  </div>
}
SaveNotificationBase.propTypes = {
  index: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
  onRemove: PropTypes.func.isRequired,
  rank: PropTypes.number.isRequired,
}
const SaveNotification = React.memo(SaveNotificationBase)


interface Notifiable {
  notify: () => void
}


const SaveNotifierBase = (props: {}, ref: React.Ref<Notifiable>): React.ReactElement => {
  const [saves, setSaves] = useState<readonly SaveState[]>([])
  const [totalSavesCount, setTotalSavesCount] = useState(0)

  const notify = useCallback((): void => {
    setSaves((saves): readonly SaveState[] => [...saves, {isActive: false, rank: totalSavesCount}])
  }, [totalSavesCount])

  useImperativeHandle(ref, (): Notifiable => ({notify}))

  const setActiveSave = useCallback((rankToSet: number, setActive: boolean): void => {
    setSaves((saves): readonly SaveState[] => saves.map(
      ({isActive, rank}): SaveState => ({
        isActive: rank === rankToSet ? setActive : isActive,
        rank,
      }),
    ))
  }, [])

  const removeSave = useCallback((n: number): void => {
    setSaves((saves): readonly SaveState[] => saves.filter(({rank}): boolean => rank !== n))
  }, [])

  const savesTimeout = useRef<number[]>([])

  useEffect((): void => {
    const lastSave = saves.find(({rank}: SaveState): boolean => rank === totalSavesCount)
    if (!lastSave || lastSave.isActive) {
      return
    }
    setTotalSavesCount(totalSavesCount + 1)
    setActiveSave(totalSavesCount, true)
    const timeout = window.setTimeout((): void => setActiveSave(totalSavesCount, false), 2000)
    savesTimeout.current?.push(timeout)
  }, [saves, setActiveSave, totalSavesCount])

  useEffect((): (() => void) => (): void => {
    savesTimeout.current?.forEach((timeout: number): void => clearTimeout(timeout))
  }, [])

  return <React.Fragment>
    {saves.map((save, index): React.ReactNode => <SaveNotification
      key={save.rank} index={index} onRemove={removeSave} {...save} />)}
  </React.Fragment>
}
const SaveNotifier = React.memo(React.forwardRef(SaveNotifierBase))


const PageViewBase = (props: PageViewProps): React.ReactElement => {
  const {featuresEnabled, hasAccount = false, onChange, stepName, userProfile} = props
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const saveNotifier = useRef<Notifiable>(null)
  const {t} = useTranslation()

  const tabs = useMemo((): readonly UserPageViewTab[] => PAGE_VIEW_TABS.
    filter(({predicate}): boolean => !predicate || predicate(hasAccount, userProfile)).
    map(({fragment, title}) => ({fragment, title: title(hasAccount, userProfile, t)})),
  [hasAccount, t, userProfile])

  const handleChange = useCallback((userDiff: bayes.bob.User): void => {
    dispatch(diagnoseOnboarding(userDiff)).then(saveNotifier.current?.notify)
  }, [dispatch])

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
    <SaveNotifier ref={saveNotifier} />
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
            onChange={handleChange}
            contentStyle={contentStyle}
            style={stepStyle}
            // Hide previous button.
            onPreviousButtonClick={null}
            isShownAsStepsDuringOnboarding={false}
            buttonsOverride={<div />}
            profile={userProfile}
            featuresEnabled={featuresEnabled} hasAccount={hasAccount} t={t} />
        })}
      </div>
    </div>
  </div>
}
const PageView = React.memo(PageViewBase)


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
    const defaultStepName = profile?.name ? 'profil' : 'confidentialite'
    return <Redirect to={`${url}/${defaultStepName}`} />
  }
  return <OnboardingView
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
