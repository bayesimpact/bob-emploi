import type {LocationDescriptor} from 'history'
import _uniqueId from 'lodash/uniqueId'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {generatePath, useLocation} from 'react-router'
import type {LinkProps} from 'react-router-dom'
import {Link} from 'react-router-dom'

import useFastForward from 'hooks/fast_forward'
import {useOnGroupBlur} from 'hooks/focus'
import useOnScreen from 'hooks/on_screen'
import {useHasScrolledOnceAtBottom} from 'hooks/scroll'
import {useIsTabNavigationUsed} from 'hooks/tab_navigation'
import type {RootState} from 'store/actions'
import {clickExploreActions, logout, modifyProject, useDispatch} from 'store/actions'
import {getLanguage} from 'store/i18n'
import {onboardingComplete} from 'store/main_selectors'
import {useProject} from 'store/project'
import {useActionPlan, useEmailsInProfile} from 'store/user'

import deploymentNavbarStyle from 'deployment/navigation'
import logoProductWhiteImage from 'deployment/bob-logo.svg?fill=%23fff'
import logoProductImage from 'deployment/bob-logo.svg'
import SecondaryLogo from 'deployment/secondary_logo'

import AccountDeletionModal from 'components/account_deletion_modal'
import Button from 'components/button'
import DebugModal from 'components/debug_modal'
import HelpDeskLink, {useHelpDeskLinkProps} from 'components/help_desk_link'
import Trans from 'components/i18n_trans'
import LinkButton from 'components/link_button'
import {LoginButton, LoginLink, useLoginLink} from 'components/login'
import isMobileVersion from 'store/mobile'
import type {ModalConfig} from 'components/modal'
import {Modal} from 'components/modal'
import {SmartLink, useRadium} from 'components/radium'
import SkipToContent from 'components/skip_to_content'
import {MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions} from 'components/theme'
import UpDownIcon from 'components/up_down_icon'
import ZendeskChatButton from 'components/zendesk_chat_button'

import {getPageDescription} from '../../release/lambdas/opengraph_redirect'

import {CookieMessage} from './cookie_message'
import {Routes} from './url'

export const NAVIGATION_BAR_HEIGHT = 56
const notImplemented = () => window.alert('Bientôt disponible…')

const outlineLinkStyle: RadiumCSSProperties = {
  ':focus': {
    outline: `solid 2px ${colors.DARK_TWO}`,
  },
  'borderRadius': 3,
}

const LandingPageLinkBase = ({children}: {children: React.ReactNode}): React.ReactElement => {
  const isTabNavigationUsed = useIsTabNavigationUsed()
  const {t} = useTranslation('components')
  return <SmartLink
    to={config.externalLandingPageUrl ? undefined : Routes.ROOT}
    href={config.externalLandingPageUrl}
    style={isTabNavigationUsed ? outlineLinkStyle : undefined}
    title={`${config.productName} - ${t('Accueil')}`}>
    {children}
  </SmartLink>
}
const LandingPageLink = React.memo(LandingPageLinkBase)

const MENU_LINK_HEIGHT = 50

const menuLinkStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.DARK_TWO,
  display: 'flex',
  fontWeight: 'normal',
  height: MENU_LINK_HEIGHT,
  paddingLeft: 25,
  textAlign: 'left',
  width: '100%',
}
const menuLinkHoverStyle = {
  backgroundColor: colors.BOB_BLUE,
  color: '#fff',
}
const MenuLinkBase: React.FC<React.ComponentProps<typeof SmartLink>> =
({style, ...extraProps}: React.ComponentProps<typeof SmartLink>): React.ReactElement => {
  const containerStyle = useMemo(() => ({
    ...menuLinkStyle,
    ...style,
    ':focus': {
      ...menuLinkHoverStyle,
      ...style ? style[':hover'] : {},
    },
    ':hover': {
      ...menuLinkHoverStyle,
      ...style ? style[':hover'] : {},
    },
  }), [style])
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <SmartLink {...extraProps} style={containerStyle} />
}
const MenuLink = React.memo(MenuLinkBase)


const loginButtonStyle: React.CSSProperties = {
  fontWeight: 'bold',
}

interface LoggedOutNavBarProps {
  isHidden?: true
  isSignUp?: true
  style?: React.CSSProperties
  visualElement?: string
}

const LoggedOutNavBarBase = (props: LoggedOutNavBarProps) => {
  const {t} = useTranslation('components')
  const {isHidden, isSignUp, style, visualElement} = props
  const containerStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    color: colors.DARK,
    fontSize: 14,
    height: 70,
    left: 0,
    padding: isMobileVersion ? '0 30px' : '0 20px',
    position: 'relative',
    right: 0,
    ...style,
  }
  const contentStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    height: containerStyle.height,
    margin: '0 auto',
    maxWidth: MAX_CONTENT_WIDTH,
  }
  return <div style={containerStyle} aria-hidden={isHidden}>
    <div style={contentStyle}>
      <img src={logoProductImage} height={30} alt={config.productName} />
      <span style={{flex: 1}} />

      <LoginButton
        isSignUp={isSignUp} visualElement={visualElement || 'nav-bar'} type="outline" isRound={true}
        tabIndex={isHidden ? -1 : undefined} style={loginButtonStyle}>
        {isSignUp ? t('Commencer') : t('Se connecter')}
      </LoginButton>
    </div>
  </div>
}
const LoggedOutNavBar = React.memo(LoggedOutNavBarBase)

const WithScrollNavBarBase = ({children}: {children: React.ReactNode}) => {
  const [isScrollNavBarShown, setIsScrollNavBarShown] = useState(false)
  const navbarStyle = useMemo((): React.CSSProperties => ({
    boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.2)',
    opacity: isScrollNavBarShown ? 1 : 0,
    position: 'fixed',
    top: isScrollNavBarShown ? 0 : -80,
    zIndex: 2,
    ...SmoothTransitions,
  }), [isScrollNavBarShown])

  const topSpaceRef = useRef<HTMLDivElement>(null)
  const handleTopVisibilityChange = useCallback((isTopShown?: boolean): void => {
    // When first loading the page, isTopShown is false because the div has no height yet.
    setIsScrollNavBarShown(!isTopShown && !!topSpaceRef.current?.clientHeight)
  }, [])
  useOnScreen(topSpaceRef, {onChange: handleTopVisibilityChange})

  return <React.Fragment>
    <div style={{height: 70, position: 'absolute', width: '100%'}} ref={topSpaceRef} />
    {children}
    <LoggedOutNavBar
      visualElement="scrolling-nav-bar" isSignUp={true} style={navbarStyle} isHidden={true} />
  </React.Fragment>
}
const WithScrollNavBar = React.memo(WithScrollNavBarBase)

interface NavBarConnectedProps {
  hasActionPlanPage: boolean
  hasBlueBackground: boolean
  isGuest: boolean
  isLoggedIn: boolean
  isOnboardingComplete: boolean
  project?: bayes.bob.Project
  userName?: string
}

interface NavBarProps {
  // Allow only one child: it will be part of a flex flow so it can use
  // alignSelf to change its own layout.
  children?: string | React.ReactElement<{style?: React.CSSProperties}>
  isLogoShown?: boolean
  isTransparent?: boolean
  // A string is handled as a relative URL to route back to.
  onBackClick?: LinkProps['to'] | (() => void)
  // TODO(cyrille): Use template string type.
  page?: string
  style?: React.CSSProperties
}

const backIconStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fill: '#fff',
  height: 50,
  justifyContent: 'center',
  left: 0,
  padding: 10,
  position: 'absolute',
  top: 0,
  width: 50,
}

const isCallback = (onBackClick: NavBarProps['onBackClick']): onBackClick is (() => void) =>
  typeof onBackClick === 'function'

const MobileBackChevronBase: React.FC<Pick<NavBarProps, 'onBackClick'>> =
({onBackClick}): React.ReactElement|null => {
  const {t} = useTranslation('components')
  if (!onBackClick) {
    return null
  }
  if (isCallback(onBackClick)) {
    return <button onClick={onBackClick} style={backIconStyle} aria-label={t('Précédent')}>
      <ChevronLeftIcon aria-hidden={true} focusable={false} />
    </button>
  }
  return <Link to={onBackClick} aria-label={t('Précédent')} >
    <ChevronLeftIcon style={backIconStyle} aria-hidden={true} focusable={false} />
  </Link>
}
const MobileBackChevron = React.memo(MobileBackChevronBase)

const mobileMenuStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  boxShadow: '0 10px 30px rgba(0, 0, 0, .5)',
  left: 0,
  paddingTop: 50,
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 2,
}

const mobileBackgroundStyle: React.CSSProperties = {
  backgroundColor: '#000',
  bottom: 0,
  height: '100vh',
  left: 0,
  opacity: .3,
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 1,
}

const menuButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: 'transparent',
  border: 'none',
  color: 'inherit',
  display: 'flex',
  fill: '#fff',
  height: 50,
  justifyContent: 'center',
  opacity: 1,
  padding: 15,
  position: 'absolute',
  right: 0,
  top: 0,
  width: 50,
}
const menuCloseButtonStyle: React.CSSProperties = {
  ...menuButtonStyle,
  fill: colors.DARK_TWO,
  opacity: 0.5,
}

const otherPageLinkStyle: React.CSSProperties = {
  color: 'inherit',
  display: 'block',
  padding: '20px 40px',
  textDecoration: 'none',
  width: '100%',
}
const currentPageLinkStyle: React.CSSProperties = {
  ...otherPageLinkStyle,
  backgroundColor: colors.BOB_BLUE,
  color: '#fff',
}

interface ModalHooks {
  closeMenu: () => void
  deleteGuest: () => void
  hideAccountDeletionModal: () => void
  hideModifyProjectModal: () => void
  isAccountDeletionModalShown: boolean
  isMenuShown: boolean
  isModifyProjectModalShown: boolean
  logOut: () => unknown
  openModifyProjectModal: () => void
  toggleMenu: () => void
}

const useNavigationStore = (): NavBarConnectedProps => {
  const isOnboardingComplete = useSelector(({user}: RootState) => onboardingComplete(user))
  const hasAccount = useSelector(({user: {hasAccount}}: RootState) => hasAccount)
  const project = useProject()
  const userName = useSelector(({user: {profile: {name = ''} = {}}}: RootState) => name)
  const isLoggedIn = !!userName
  return {
    hasActionPlanPage: useActionPlan() && !!project?.actionPlanStartedAt,
    hasBlueBackground: !config.isSimpleOnboardingEnabled && isLoggedIn,
    isGuest: !hasAccount,
    isLoggedIn,
    isOnboardingComplete,
    project,
    userName,
  }
}

const useNavigationActions = (): ModalHooks => {
  const dispatch = useDispatch()
  const [isMenuShown, setIsMenuShown] = useState(false)
  const [isAccountDeletionModalShown, setIsAccountDeletionModalShown] = useState(false)
  const [isModifyProjectModalShown, setIsModifyProjectModalShown] = useState(false)
  const hideAccountDeletionModal = useCallback(() => setIsAccountDeletionModalShown(false), [])
  const hideModifyProjectModal = useCallback(() => setIsModifyProjectModalShown(false), [])
  const toggleMenu = useCallback(() => setIsMenuShown(wasMenuShown => !wasMenuShown), [])
  const closeMenuTimeout = useRef<number|undefined>(undefined)
  useEffect((): (() => void) => (): void => {
    if (closeMenuTimeout.current) {
      window.clearTimeout(closeMenuTimeout.current)
    }
  }, [])
  useEffect((): (() => void) => {
    document.body.style.overflow = isMenuShown ? 'hidden' : 'initial'
    return (): void => {
      document.body.style.overflow = 'initial'
    }
  }, [isMenuShown])
  const closeMenu = useCallback((): void => {
    if (!isMenuShown) {
      return
    }
    closeMenuTimeout.current = window.setTimeout((): void => setIsMenuShown(false), 50)
  }, [isMenuShown])
  const openModifyProjectModal = useCallback((): void => {
    closeMenu()
    setIsModifyProjectModalShown(true)
  }, [closeMenu])
  const deleteGuest = useCallback((): void => {
    closeMenu()
    setIsAccountDeletionModalShown(true)
  }, [closeMenu])
  const logOut = useCallback((): unknown => dispatch(logout()), [dispatch])
  return {
    closeMenu,
    deleteGuest,
    hideAccountDeletionModal,
    hideModifyProjectModal,
    isAccountDeletionModalShown,
    isMenuShown,
    isModifyProjectModalShown,
    logOut,
    openModifyProjectModal,
    toggleMenu,
  }
}

const MobileNavigationBarBase: React.FC<NavBarProps> = (props): React.ReactElement => {
  const {children, isLogoShown, onBackClick, page} = props
  const {hasActionPlanPage, hasBlueBackground, isGuest, isLoggedIn, project,
    project: {isIncomplete, projectId = ''} = {}} = useNavigationStore()
  const {
    closeMenu,
    deleteGuest,
    hideModifyProjectModal,
    hideAccountDeletionModal,
    isAccountDeletionModalShown,
    isMenuShown,
    isModifyProjectModalShown,
    logOut,
    openModifyProjectModal,
    toggleMenu,
  } = useNavigationActions()
  const style = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: hasBlueBackground ? colors.BOB_BLUE : '#fff',
    color: isMenuShown ? 'inherit' : '#fff',
    display: 'flex',
    height: 50,
    justifyContent: 'center',
    position: 'relative',
  }), [hasBlueBackground, isMenuShown])
  const leftLogoStyle: React.CSSProperties = {
    left: isMobileVersion ? 30 : 20,
    position: 'absolute',
    top: 10,
  }
  const {t} = useTranslation('components')
  const dispatch = useDispatch()
  const linkStyle = (otherPage: string): React.CSSProperties =>
    otherPage === page ? currentPageLinkStyle : otherPageLinkStyle
  const isProjectModifiable = !!projectId && !isIncomplete
  const finalMenuButtonStyle: React.CSSProperties = useMemo(() => ({
    ...menuButtonStyle,
    ...!hasBlueBackground ? {color: colors.COOL_GREY} : {},
  }), [hasBlueBackground])
  const onClickExploreActions = useCallback(() => {
    notImplemented()
    if (!project) {
      return
    }
    dispatch(clickExploreActions(project))
  }, [dispatch, project])
  const closeOnGroupBlurHandlers = useOnGroupBlur(closeMenu)
  if (page === 'landing') {
    return <LoggedOutNavBar style={{position: 'relative'}} />
  }
  return <header role="banner" style={style}>
    <AccountDeletionModal
      isShown={isAccountDeletionModalShown}
      onClose={hideAccountDeletionModal} />
    {isProjectModifiable && project ? <ModifyProjectModal
      isShown={isModifyProjectModalShown}
      onClose={hideModifyProjectModal}
      project={project} /> : null}
    <MobileBackChevron onBackClick={onBackClick} />
    <nav role="navigation" {...closeOnGroupBlurHandlers}>
      {isMenuShown ?
        <React.Fragment>
          {/* Closing the menu is already handled by multiple keyboard events. */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
          <div style={mobileBackgroundStyle} onClick={closeMenu} />
          <div style={mobileMenuStyle}>
            <button onClick={toggleMenu} style={menuCloseButtonStyle} type="button">
              <CloseIcon aria-label={t('Fermer')} />
            </button>
            {isGuest ? <LoginLink visualElement="menu" style={linkStyle('login')} isSignUp={true}>
              {t('Créer mon compte')}
            </LoginLink> : null}
            {hasActionPlanPage ? <React.Fragment>
              <Link
                to={generatePath(Routes.ACTION_PLAN_PLAN_PAGE, {projectId})}
                style={linkStyle('action-plan-plan')}>
                {t("Mon plan d'action")}
              </Link>
              <button
                style={otherPageLinkStyle} onClick={onClickExploreActions} tabIndex={0}
                type="button">
                {t('Explorer des actions')}
              </button>
            </React.Fragment> : null}
            {isProjectModifiable ? <button
              style={otherPageLinkStyle} onClick={openModifyProjectModal} tabIndex={0}
              type="button">
              {t('Modifier mon projet')}
            </button> : null}
            <Link
              to={Routes.PROFILE_PAGE}
              style={linkStyle('profile')}>
              {t('Mes informations')}
            </Link>
            <HelpDeskLink style={otherPageLinkStyle}>{t('Nous contacter')}</HelpDeskLink>
            {isGuest ? <SmartLink
              style={otherPageLinkStyle}
              onClick={deleteGuest}>
              {t('Supprimer mes informations')}
            </SmartLink> :
              <Link to={Routes.ROOT} style={otherPageLinkStyle} onClick={logOut}>
                {t('Déconnexion')}
              </Link>}
          </div>
        </React.Fragment> : isLoggedIn ?
          <button style={finalMenuButtonStyle} onClick={toggleMenu} type="button">
            <MenuIcon aria-label={t('menu')} />
          </button> : null
      }
    </nav>
    {children ? <NavigationBarChildren>{children}</NavigationBarChildren> :
      isLogoShown ? <LandingPageLink>
        <img
          src={hasBlueBackground ? logoProductWhiteImage : logoProductImage}
          alt={config.productName} style={hasBlueBackground ? {height: 22} : leftLogoStyle} />
      </LandingPageLink> : null}
  </header>
}

const logoWhite = <img src={logoProductWhiteImage} style={{height: 30}} alt={config.productName} />
const logo = <img src={logoProductImage} style={{height: 30}} alt={config.productName} />

type AnonymousNavBarProps = Pick<NavBarProps, 'isLogoShown'|'style'|'children'|'page'>

const reducedNavBarStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  height: '100%',
  justifyContent: 'center',
  margin: 'auto',
  maxWidth: MAX_CONTENT_WIDTH,
  position: 'relative',
}

const logoContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  bottom: 0,
  display: 'flex',
  left: 0,
  position: 'absolute',
  top: 0,
}

const connectContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  bottom: 0,
  display: 'flex',
  position: 'absolute',
  right: 0,
  top: 0,
}

const secondaryLogoStyle = {
  height: 50,
  marginLeft: 20,
}
const AnonymousNavigationBarBase: React.FC<AnonymousNavBarProps> = (props): React.ReactElement => {
  const {children, isLogoShown, page, style} = props
  const reducedContainerStyle = useMemo((): React.CSSProperties => ({
    ...style,
    display: 'block',
    padding: `0 ${MIN_CONTENT_PADDING}px`,
    ...deploymentNavbarStyle,
  }), [style])
  const {t} = useTranslation('components')
  return <header role="banner" style={reducedContainerStyle}>
    <div style={reducedNavBarStyle}>
      <div style={logoContainerStyle}>
        {isLogoShown ? <LandingPageLink>{logo}</LandingPageLink> : null}
        {page === 'landing' ? <SecondaryLogo style={secondaryLogoStyle} /> : null}
      </div>

      {children}

      <div style={connectContainerStyle}>
        <LoginButton
          type="outline"
          style={loginButtonStyle}
          visualElement="navbar"
          isRound={true}>
          {t('Se connecter')}
        </LoginButton>
      </div>
    </div>
  </header>
}
const AnonymousNavigationBar = React.memo(AnonymousNavigationBarBase)

const childStyle: React.CSSProperties = {flex: 1, margin: 0, textAlign: 'center'}

const NavigationBarChildren: React.FC<Pick<NavBarProps, 'children'>> =
({children}: Pick<NavBarProps, 'children'>): React.ReactElement => {
  if (!children || typeof children === 'string') {
    return <p style={childStyle}>{children}</p>
  }
  return React.cloneElement(children, {
    style: {
      ...childStyle,
      ...children.props.style,
    },
  })
}


// TODO(cyrille): Use components/radium instead.
const RadiumButtonBase = (props: React.ButtonHTMLAttributes<HTMLButtonElement>):
React.ReactElement =>
  <button
    type="button"
    {...useRadium<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(props)[0]} />
const RadiumButton = React.memo(RadiumButtonBase)


const linkContainerStyle: React.CSSProperties = {
  alignSelf: 'stretch',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  padding: '7px 40px',
  textAlign: 'center',
  textDecoration: 'none',
}

const menuStyle: React.CSSProperties = {
  ...linkContainerStyle,
  cursor: 'pointer',
  minWidth: 180,
  outline: 'none',
  position: 'relative',
}

const logoOnLeftStyle: React.CSSProperties = {
  // Have same outerWidth for menu and logo, so that children are centered.
  minWidth: menuStyle.minWidth,
  paddingLeft: 21,
}
const desktopMenuIconStyle: React.CSSProperties = {
  height: 25,
  marginTop: -1,
  paddingRight: 1,
  width: 26,
}
const noListItemStyle: React.CSSProperties = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}

const onboardingLeftSpaceStyle = {
  flex: `1 1 ${menuStyle.minWidth}px`,
}

const NavigationBarBase: React.FC<NavBarProps> = (props): React.ReactElement => {
  const {children, isLogoShown, isTransparent, page, style} = props
  const {hasActionPlanPage, hasBlueBackground, isGuest, isLoggedIn, isOnboardingComplete, project,
    project: {isIncomplete, projectId = ''} = {}, userName} = useNavigationStore()
  const helpDeskLinkProps = useHelpDeskLinkProps()
  const {closeMenu,
    deleteGuest,
    hideModifyProjectModal,
    hideAccountDeletionModal,
    isAccountDeletionModalShown,
    isMenuShown,
    isModifyProjectModalShown,
    logOut,
    openModifyProjectModal,
    toggleMenu,
  } = useNavigationActions()
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: isTransparent ? 'initial' : hasBlueBackground ? colors.BOB_BLUE : '#fff',
    color: '#fff',
    display: 'flex',
    height: NAVIGATION_BAR_HEIGHT * (isTransparent ? 1.5 : 1),
    justifyContent: 'flex-end',
    position: isTransparent ? 'absolute' : 'relative',
    width: '100%',
    zIndex: isTransparent ? 2 : 'initial',
    ...style,
  }), [hasBlueBackground, isTransparent, style])
  const dropDownButtonStyle = useMemo((): RadiumCSSProperties => ({
    ':focus': {
      backgroundColor: isMenuShown ? '#fff' : colors.NICE_BLUE,
    },
    ':hover': {
      backgroundColor: isMenuShown ? '#fff' : colors.NICE_BLUE,
    },
    'alignItems': 'center',
    'backgroundColor': isMenuShown ? '#fff' : 'initial',
    'bottom': 0,
    'color': isMenuShown ? colors.DARK_TWO : '#fff',
    'display': 'flex',
    'justifyContent': 'center',
    'left': 0,
    'padding': 25,
    'position': 'absolute',
    'right': 0,
    'top': 0,
    'width': '100%',
    ...SmoothTransitions,
  }), [isMenuShown])
  const dropDownStyle = useMemo((): React.CSSProperties => ({
    ...linkContainerStyle,
    alignItems: 'center',
    backgroundColor: dropDownButtonStyle.backgroundColor,
    borderTop: isMenuShown ? 'solid 1px rgba(255, 255, 255, .2)' : 'none',
    boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.2)',
    fontWeight: isMenuShown ? 'bold' : 'normal',
    height: isMenuShown ? 'initial' : 0,
    justifyContent: 'center',
    left: 0,
    listStyleType: 'none',
    margin: 0,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    right: 0,
    top: '100%',
    transition: 'height 100ms',
    zIndex: 2,
  }), [dropDownButtonStyle.backgroundColor, isMenuShown])
  const {t} = useTranslation('components')
  const dispatch = useDispatch()
  const canSeeEmails = useEmailsInProfile()
  const {onClick: clickToLogin, to: toLogin} = useLoginLink(undefined, true, 'menu')
  const onClickExploreActions = useCallback(() => {
    notImplemented()
    if (!project) {
      return
    }
    dispatch(clickExploreActions(project))
  }, [dispatch, project])
  const menuId = useMemo(_uniqueId, [])
  const closeOnGroupBlurHandlers = useOnGroupBlur(closeMenu)
  if (config.isSimpleOnboardingEnabled || !isLoggedIn) {
    return <AnonymousNavigationBar page={page} style={containerStyle} isLogoShown={isLogoShown}>
      {children}
    </AnonymousNavigationBar>
  }
  const isDuringOnboarding =
    (page === 'profile' || page === 'new_project') && !isOnboardingComplete
  const isProjectModifiable = projectId && !isIncomplete
  // TODO(cyrille): Unify behavior for menu between Mobile and Desktop.
  return <header role="banner" style={containerStyle}>
    <AccountDeletionModal
      isShown={isAccountDeletionModalShown}
      onClose={hideAccountDeletionModal} />
    {isProjectModifiable && project ? <ModifyProjectModal
      isShown={isModifyProjectModalShown}
      onClose={hideModifyProjectModal}
      project={project} /> : null}
    {isDuringOnboarding ? <React.Fragment>
      <span style={onboardingLeftSpaceStyle}></span>
      {isLogoShown ? logoWhite : null}
    </React.Fragment> :
      <div style={logoOnLeftStyle}>
        {isLogoShown ? <LandingPageLink>{logoWhite}</LandingPageLink> : null}
      </div>}

    <NavigationBarChildren>{children}</NavigationBarChildren>

    <nav role="navigation" {...closeOnGroupBlurHandlers} style={menuStyle}>
      <RadiumButton
        style={dropDownButtonStyle} onClick={toggleMenu}
        aria-controls={menuId}>
        {userName}&nbsp;<span style={{flex: 1}} /><UpDownIcon
          icon="menu"
          isUp={isMenuShown}
          style={desktopMenuIconStyle}
          focusable={false}
          role="img"
          aria-label={isMenuShown ? t('Fermer le menu') : t('Ouvrir le menu')} />
      </RadiumButton>
      <ul style={dropDownStyle} aria-hidden={!isMenuShown} id={menuId}>
        {isGuest && config.isLoginEnabled ?
          <li style={noListItemStyle}>
            <MenuLink
              style={{fontWeight: 'bold', width: '100%'}} to={toLogin || undefined}
              onClick={clickToLogin} tabIndex={isMenuShown ? 0 : -1}>
              {t('Créer mon compte')}
            </MenuLink>
          </li> : null}
        {hasActionPlanPage ? <React.Fragment>
          <li style={noListItemStyle}>
            <MenuLink to={generatePath(Routes.ACTION_PLAN_PLAN_PAGE, {projectId})}
              tabIndex={isMenuShown ? 0 : -1}>
              {t("Mon plan d'action")}
            </MenuLink>
          </li>
          <li style={noListItemStyle}>
            <MenuLink onClick={onClickExploreActions} tabIndex={isMenuShown ? 0 : -1}>
              {t('Explorer des actions')}
            </MenuLink>
          </li>
        </React.Fragment> : null}
        <li style={noListItemStyle}>
          <MenuLink to={Routes.PROFILE_PAGE} tabIndex={isMenuShown ? 0 : -1}>
            {t('Mes informations')}
          </MenuLink>
        </li>
        {canSeeEmails ? <li style={noListItemStyle}>
          <MenuLink to={Routes.EMAILS_PAGE} tabIndex={isMenuShown ? 0 : -1}>
            {t('Mes emails')}
          </MenuLink>
        </li> : null}
        {isProjectModifiable ?
          <li style={noListItemStyle}>
            <MenuLink onClick={openModifyProjectModal} tabIndex={isMenuShown ? 0 : -1}>
              {t('Modifier mon projet')}
            </MenuLink>
          </li> : null}
        <li style={noListItemStyle}>
          <MenuLink to={Routes.CONTRIBUTION_PAGE} tabIndex={isMenuShown ? 0 : -1}>
            {t('Contribuer')}
          </MenuLink>
        </li>
        {
          // TODO(cyrille): Consider dropping this entirely, or revamping it.
          config.countryId === 'fr' ? <li style={noListItemStyle}>
            <MenuLink
              {...helpDeskLinkProps} href="https://aide.bob-emploi.fr/hc/fr"
              tabIndex={isMenuShown ? 0 : -1}>
              {t('Aide')}
            </MenuLink>
          </li> : null}
        <li style={noListItemStyle}>
          <MenuLink {...helpDeskLinkProps} tabIndex={isMenuShown ? 0 : -1}>
            {t('Nous contacter')}
          </MenuLink>
        </li>
        <li style={noListItemStyle}>
          {isGuest ? <MenuLink
            onClick={deleteGuest} tabIndex={isMenuShown ? 0 : -1}
            style={{':hover': {color: '#fff'}, 'color': colors.COOL_GREY}}>
            {t('Supprimer mes informations')}
          </MenuLink> : <MenuLink
            onClick={logOut} to={Routes.ROOT} tabIndex={isMenuShown ? 0 : -1}
            style={{':hover': {color: '#fff'}, 'color': colors.COOL_GREY}}>
            {t('Déconnexion')}
          </MenuLink>}
        </li>
      </ul>
    </nav>
  </header>
}
const NavigationBar = React.memo(isMobileVersion ? MobileNavigationBarBase : NavigationBarBase)


// Hook that listens to location changes (from React Router) and
// updates the HTML title and meta description.
const useTitleUpdate = (basename = ''): void => {
  const {pathname} = useLocation()
  const [translate] = useTranslation('opengraph')
  useEffect(() => {
    const {description, title} = getPageDescription(
      (basename + pathname).slice(1), config.productName, config.canonicalUrl)
    // Update the title.
    for (const titleElement of document.getElementsByTagName('title')) {
      titleElement.textContent = translate(title)
    }

    // Update the description.
    for (const metaElement of document.getElementsByTagName('meta')) {
      if (metaElement.getAttribute('name') === 'description') {
        metaElement.setAttribute('content', translate(description) || '')
      }
    }
  }, [basename, pathname, translate])
}


type ChatButtonProps = Omit<React.ComponentProps<typeof ZendeskChatButton>, 'language' | 'user'>
const ChatButtonBase = (props: ChatButtonProps): React.ReactElement => {
  const {language, user} = useSelector(({user: {profile}}: RootState) => ({
    language: getLanguage(profile?.locale),
    user: profile,
  }))
  return <ZendeskChatButton {...props} language={language} user={user} />
}
const ChatButton = React.memo(ChatButtonBase)



interface ScrollOptions {
  behavior?: 'smooth'
  top: number
}


export interface Scrollable {
  scroll: (options: ScrollOptions) => void
  scrollDelta: (delta: number) => void
  scrollTo: (top: number) => void
}

interface ContentProps {
  children?: React.ReactNode|null
  isContentScrollable?: boolean
  isMain?: boolean
  onScroll?: () => void
  style?: React.CSSProperties
}

export interface PageWithNavigationBarProps extends
  ContentProps, Pick<NavBarProps, 'onBackClick' | 'page'> {
  isChatButtonShown?: boolean
  isCookieDisclaimerShown?: boolean
  isLogoShown?: false
  isNavBarTransparent?: boolean
  navBarContent?: string | JSX.Element
}

const outerContainerStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
}

const getContainerStyle = (isContentScrollable?: boolean, style?: React.CSSProperties):
React.CSSProperties => isContentScrollable ? {
  WebkitOverflowScrolling: 'touch',
  bottom: 0,
  left: 0,
  overflow: 'auto',
  position: 'absolute',
  right: '0',
  top: '0',
  ...style,
} : {
  flex: 1,
  position: 'relative',
  zIndex: 0,
  ...style,
}

const PageContentBase: React.RefForwardingComponent<Scrollable, ContentProps> =
(props: ContentProps, ref: React.Ref<Scrollable>): React.ReactElement => {
  const {children, isContentScrollable, isMain = true, onScroll, style, ...extraProps} = props
  const scrollableDom = useRef<HTMLElement|HTMLBodyElement>(window.document.body as HTMLBodyElement)
  useEffect((): (() => void) => {
    if (!isContentScrollable && onScroll) {
      window.addEventListener('scroll', onScroll)
    }
    return (): void => {
      if (!isContentScrollable && onScroll) {
        window.removeEventListener('scroll', onScroll)
      }
    }
  }, [isContentScrollable, onScroll])
  const scroll = useCallback((options: ScrollOptions): void => {
    if (scrollableDom.current) {
      scrollableDom.current.scroll(options)
    }
  }, [scrollableDom])
  const scrollDelta = useCallback((deltaOffsetTop: number): void => {
    if (scrollableDom.current) {
      scrollableDom.current.scroll({
        behavior: 'smooth',
        top: scrollableDom.current.scrollTop + deltaOffsetTop,
      })
    }
  }, [scrollableDom])
  const scrollTo = useCallback((offsetTop: number): void => {
    if (scrollableDom.current) {
      scrollableDom.current.scrollTop = offsetTop
    }
  }, [scrollableDom])
  useImperativeHandle(ref, () => ({scroll, scrollDelta, scrollTo}), [scroll, scrollDelta, scrollTo])
  const containerStyle = useMemo(
    (): React.CSSProperties => getContainerStyle(isContentScrollable, style),
    [isContentScrollable, style])
  if (isContentScrollable) {
    return <div style={outerContainerStyle}>
      {React.createElement(
        isMain ? 'main' : 'div',
        {
          id: isMain ? 'main' : undefined,
          onScroll,
          ref: scrollableDom as React.Ref<HTMLElement>,
          role: isMain ? 'main' : undefined,
          style: containerStyle,
          tabIndex: isMain ? -1 : undefined,
          ...extraProps,
        },
        children)}
    </div>
  }
  return React.createElement(
    isMain ? 'main' : 'div',
    {
      id: isMain ? 'main' : undefined,
      role: isMain ? 'main' : undefined,
      style: containerStyle,
      tabIndex: isMain ? -1 : undefined,
      ...extraProps,
    },
    children)
}
const PageContent = React.forwardRef(PageContentBase)

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
}

const contentScrollablePageStyle: React.CSSProperties = {
  ...pageStyle,
  height: '100vh',
}

const pageWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
}

const navBarStyle = {flexShrink: 0}

const PageWithNavigationBarBase:
React.RefForwardingComponent<Scrollable, PageWithNavigationBarProps> =
(props: PageWithNavigationBarProps, ref: React.Ref<Scrollable>): React.ReactElement => {
  const {isChatButtonShown, isContentScrollable,
    isCookieDisclaimerShown = true, isLogoShown = true, isNavBarTransparent, navBarContent,
    onBackClick, page, ...extraProps} = props
  useTitleUpdate()
  return <div style={isContentScrollable ? contentScrollablePageStyle : pageStyle}>
    <SkipToContent />
    {isCookieDisclaimerShown ? <CookieMessage style={{flexShrink: 0}} /> : null}
    <div style={pageWrapperStyle}>
      <NavigationBar
        page={page} onBackClick={onBackClick} isTransparent={isNavBarTransparent}
        isLogoShown={isLogoShown} style={navBarStyle}>
        {navBarContent}
      </NavigationBar>
      <ChatButton
        isShown={isChatButtonShown && !isMobileVersion}
        domain={config.zendeskDomain} />

      <DebugModal />

      <PageContent isContentScrollable={isContentScrollable} ref={ref} {...extraProps} />
    </div>
  </div>
}
const PageWithNavigationBar = React.forwardRef(PageWithNavigationBarBase)


interface ModifyProjectModalProps extends Omit<ModalConfig, 'children'> {
  project: bayes.bob.Project
}


const modalStyle: React.CSSProperties = {
  margin: isMobileVersion ? '0 20px' : 0,
  paddingBottom: isMobileVersion ? 30 : 40,
}
const noticeStyle: React.CSSProperties = {
  margin: isMobileVersion ? '35px 20px 40px' : '35px 50px 40px',
  maxWidth: 400,
}
const buttonsContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  justifyContent: 'center',
}
const buttonStyle: React.CSSProperties = {
  width: 140,
}
const topBottomStyle: React.CSSProperties = {
  ...buttonStyle,
  marginBottom: isMobileVersion ? 10 : 0,
  marginRight: isMobileVersion ? 0 : 15,
}


const ModifyProjectModalBase = (props: ModifyProjectModalProps): React.ReactElement => {
  const {isShown, onClose, project, ...extraProps} = props
  const {t} = useTranslation('components')
  const dispatch = useDispatch()

  const handleConfirm = useCallback((): boolean|void => {
    if (!isShown) {
      return true
    }
    dispatch(modifyProject(project))
  }, [dispatch, isShown, project])
  useFastForward(handleConfirm)

  return <Modal
    style={modalStyle} title={t('Modifier mes informations')}
    {...{isShown, onClose}} {...extraProps}>
    <div style={noticeStyle}>
      {t('En modifiant votre projet vous perdrez certains éléments de votre diagnostic actuel.')}
    </div>
    <Trans style={buttonsContainerStyle} ns="components">
      <Button type="discreet" onClick={onClose} isRound={true} style={topBottomStyle}>
        Annuler
      </Button>
      <Button onClick={handleConfirm} isRound={true} style={buttonStyle}>
        Continuer
      </Button>
    </Trans>
  </Modal>
}
const ModifyProjectModal = React.memo(ModifyProjectModalBase)

const navigationBaseMobileStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '30px 30px 0 0',
  boxShadow: '0 -3px 20px 0 rgba(44, 52, 73, 0.1)',
  left: 0,
  marginBottom: 0,
  marginTop: 15,
  right: 0,
}
const navigationBaseStyle: React.CSSProperties = {
  bottom: 0,
  display: 'flex',
  position: 'fixed',
  ...isMobileVersion ? navigationBaseMobileStyle : {
    flexDirection: 'column',
    margin: '15px auto 0',
    paddingBottom: 40,
  },
}
const roundedButtonStyle: React.CSSProperties = {
  ...isMobileVersion && {borderRadius: 13, fontWeight: 'bold'},
  flex: 1,
  margin: '0 auto',
  minWidth: 130,
  padding: '13px 16px',
  ...isMobileVersion && {width: '100%'},
}

interface FixedNavigationProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode
  // TODO(émilie): separate the FixedNavigation compnent from the Button to avoid this.
  isChildrenButton?: boolean
  isShownOnlyWhenScrolledToBottom?: boolean
  navigationPadding?: number
  onClick?: () => void
  placeHolderExtraHeight?: number
  style?: React.CSSProperties
  // TODO(cyrille): Use `to` wherever relevant.
  to?: LocationDescriptor
  width?: number
}
const FixedButtonNavigationBase = (props: FixedNavigationProps): React.ReactElement => {
  const {navigationPadding = 30, placeHolderExtraHeight = 0, isChildrenButton = false,
    isShownOnlyWhenScrolledToBottom = false, style, to, width, onClick, ...otherProps} = props
  const hasScrolledOnceAtBottom = useHasScrolledOnceAtBottom(isShownOnlyWhenScrolledToBottom)

  const navigationStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    padding: navigationPadding,
    ...navigationBaseStyle,
    ...width ? {width} : {},
    ...style,
    ...(!isShownOnlyWhenScrolledToBottom || hasScrolledOnceAtBottom) ? {} : {display: 'none'},
  }), [hasScrolledOnceAtBottom, navigationPadding, isShownOnlyWhenScrolledToBottom, style, width])
  const navigationPlaceholderStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    height: 120 + placeHolderExtraHeight,
  }), [placeHolderExtraHeight])
  if (to) {
    return <React.Fragment>
      <div style={navigationStyle}>
        <LinkButton
          isRound={!isMobileVersion} to={to} onClick={onClick} style={roundedButtonStyle}
          {...otherProps} />
      </div>
      <div style={navigationPlaceholderStyle} />
    </React.Fragment>
  }
  if (isChildrenButton && otherProps.children) {
    return <React.Fragment>
      <div style={navigationStyle}>
        {otherProps.children}
      </div>
      <div style={navigationPlaceholderStyle} />
    </React.Fragment>
  }
  return <React.Fragment>
    <div style={navigationStyle}>
      <Button
        onClick={onClick} isRound={!isMobileVersion} {...otherProps} style={roundedButtonStyle} />
    </div>
    <div style={navigationPlaceholderStyle} />
  </React.Fragment>
}
const FixedButtonNavigation = React.memo(FixedButtonNavigationBase)

export {FixedButtonNavigation, ModifyProjectModal, PageWithNavigationBar, WithScrollNavBar,
  useTitleUpdate}
