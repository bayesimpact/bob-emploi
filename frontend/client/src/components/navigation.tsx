import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {useLocation} from 'react-router'
import {Link} from 'react-router-dom'
import VisibilitySensor from 'react-visibility-sensor'

import useFastForward from 'hooks/fast_forward'
import useKeyListener from 'hooks/key_listener'
import {RootState, logoutAction, modifyProject, noOp, useDispatch} from 'store/actions'
import {getLanguage} from 'store/i18n'
import {onboardingComplete} from 'store/main_selectors'

import logoProductWhiteImage from 'deployment/bob-logo.svg?fill=%23fff'
import logoProductBlueImage from 'deployment/bob-logo.svg?fill=%231888ff' // colors.BOB_BLUE

import AccountDeletionModal from 'components/account_deletion_modal'
import Button from 'components/button'
import DebugModal from 'components/debug_modal'
import HelpDeskLink, {useHelpDeskLinkProps} from 'components/help_desk_link'
import Trans from 'components/i18n_trans'
import {LoginButton, LoginLink, useLoginLink} from 'components/login'
import isMobileVersion from 'store/mobile'
import {Modal, ModalConfig, useModal} from 'components/modal'
import OutsideClickHandler from 'components/outside_click_handler'
import {SmartLink, useRadium} from 'components/radium'
import {MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, SmoothTransitions} from 'components/theme'
import UpDownIcon from 'components/up_down_icon'
import ZendeskChatButton from 'components/zendesk_chat_button'

import {getPageDescription} from '../../release/lambdas/opengraph_redirect'

import {CookieMessage} from './cookie_message'
import BetaMessage from './beta_message'
import {Routes} from './url'

export const NAVIGATION_BAR_HEIGHT = 56


const MENU_LINK_HEIGHT = 50

const menuLinkStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.DARK_TWO,
  display: 'flex',
  fontWeight: 'normal',
  height: MENU_LINK_HEIGHT,
  paddingLeft: 25,
  textAlign: 'left',
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
MenuLinkBase.propTypes = {
  children: PropTypes.node,
  href: PropTypes.string,
  style: PropTypes.object,
  to: PropTypes.string,
}
const MenuLink = React.memo(MenuLinkBase)


const loginButtonStyle: React.CSSProperties = {
  fontWeight: 'bold',
}

interface LoggedOutNavBarProps
  extends Pick<React.HTMLProps<HTMLDivElement>, 'aria-hidden' | 'style'> {
  isSignUp?: true
  visualElement?: string
}

const LoggedOutNavBarBase = (props: LoggedOutNavBarProps) => {
  const {t} = useTranslation()
  const {'aria-hidden': ariaHidden, isSignUp, style, visualElement} = props
  const isHidden = ariaHidden && ariaHidden !== 'false'
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
  return <div style={containerStyle} aria-hidden={ariaHidden}>
    <div style={contentStyle}>
      <img src={logoProductBlueImage} height={30} alt={config.productName} />
      <span style={{flex: 1}} />

      <LoginButton
        isSignUp={isSignUp} visualElement={visualElement || 'nav-bar'} type="outline" isRound={true}
        tabIndex={isHidden ? -1 : 1} style={loginButtonStyle}>
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

  return <React.Fragment>
    <VisibilitySensor
      onChange={handleTopVisibilityChange}
      intervalDelay={250} partialVisibility={true}>
      <div style={{height: 70, position: 'absolute', width: '100%'}} ref={topSpaceRef} />
    </VisibilitySensor>
    {children}
    <LoggedOutNavBar
      visualElement="scrolling-nav-bar" isSignUp={true}
      style={navbarStyle} aria-hidden={!isScrollNavBarShown} />
  </React.Fragment>
}
const WithScrollNavBar = React.memo(WithScrollNavBarBase)

interface NavBarConnectedProps {
  hasBlueBackground: boolean
  isGuest: boolean
  isLoggedIn: boolean
  isOnboardingComplete: boolean
  project?: bayes.bob.Project
  userName?: string
}

interface NavBarProps {
  children?: string | React.ReactElement<{style?: React.CSSProperties}>
  isLogoShown?: boolean
  isTransparent?: boolean
  onBackClick?: string | (() => void)
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

const MobileBackChevronBase: React.FC<Pick<NavBarProps, 'onBackClick'>> =
({onBackClick}): React.ReactElement|null => {
  if (!onBackClick) {
    return null
  }
  if (typeof onBackClick === 'string') {
    return <Link to={onBackClick}><ChevronLeftIcon style={backIconStyle} /></Link>
  }
  return <ChevronLeftIcon style={backIconStyle} onClick={onBackClick} />
}
MobileBackChevronBase.propTypes = {
  onBackClick: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
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

const useNavigationStore = (): NavBarConnectedProps => useSelector(({user}: RootState) => ({
  hasBlueBackground: !!(user.profile && user.profile.name),
  isGuest: !user.hasAccount,
  isLoggedIn: !!(user.profile && user.profile.name),
  isOnboardingComplete: onboardingComplete(user),
  project: user.projects && user.projects[0],
  userName: user.profile && user.profile.name,
}))

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
  const logOut = useCallback((): unknown => dispatch(logoutAction), [dispatch])
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
  const {hasBlueBackground, isGuest, isLoggedIn, project} = useNavigationStore()
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
  const {t} = useTranslation()
  const linkStyle = (otherPage: string): React.CSSProperties =>
    otherPage === page ? currentPageLinkStyle : otherPageLinkStyle
  const isProjectModifiable = project && project.projectId && !project.isIncomplete
  const finalMenuButtonStyle: React.CSSProperties = useMemo(() => ({
    ...menuButtonStyle,
    ...!hasBlueBackground ? {color: colors.COOL_GREY} : {},
  }), [hasBlueBackground])
  if (page === 'landing') {
    return <LoggedOutNavBar style={{position: 'relative'}} />
  }
  return <nav style={style}>
    <AccountDeletionModal
      isShown={isAccountDeletionModalShown}
      onClose={hideAccountDeletionModal} />
    {isProjectModifiable && project ? <ModifyProjectModal
      isShown={isModifyProjectModalShown}
      onClose={hideModifyProjectModal}
      project={project} /> : null}
    <MobileBackChevron onBackClick={onBackClick} />
    {isMenuShown ?
      <React.Fragment>
        <div style={mobileBackgroundStyle} />
        <OutsideClickHandler onOutsideClick={closeMenu}>
          <div style={mobileMenuStyle}>
            <button onClick={toggleMenu} style={menuCloseButtonStyle}>
              <CloseIcon aria-label={t('Fermer')} />
            </button>
            {isGuest ? <LoginLink visualElement="menu" style={linkStyle('login')} isSignUp={true}>
              {t('Créer mon compte')}
            </LoginLink> : null}
            {isProjectModifiable ? <button
              style={otherPageLinkStyle}
              onClick={openModifyProjectModal} tabIndex={0}>
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
        </OutsideClickHandler>
      </React.Fragment> : isLoggedIn ?
        <button style={finalMenuButtonStyle} onClick={toggleMenu}>
          <MenuIcon aria-label={t('menu')} />
        </button> : null
    }
    {/* TODO(cyrille): Make sure text is centered vertically here. */}
    {children || (isLogoShown ? <Link to={Routes.ROOT}>
      <img
        src={hasBlueBackground ? logoProductWhiteImage : logoProductBlueImage}
        alt={config.productName} style={hasBlueBackground ? {height: 22} : leftLogoStyle} />
    </Link> : null)}
  </nav>
}
MobileNavigationBarBase.propTypes = {
  // Allow only one child: it will be part of a flex flow so it can use
  // alignSelf to change its own layout.
  children: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.string,
  ]),
  isLogoShown: PropTypes.bool,
  // A string is handled as a relative URL to route back to.
  onBackClick: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  page: PropTypes.string,
}

const logo = <img src={logoProductWhiteImage} style={{height: 30}} alt={config.productName} />
const logoBlue = <img src={logoProductBlueImage} style={{height: 30}} alt={config.productName} />

type AnonymousNavBarProps = Pick<NavBarProps, 'isLogoShown'|'style'|'children'>

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

const AnonymousNavigationBarBase: React.FC<AnonymousNavBarProps> = (props): React.ReactElement => {
  const {children, isLogoShown, style} = props
  const reducedContainerStyle = useMemo((): React.CSSProperties => ({
    ...style,
    display: 'block',
    padding: `0 ${MIN_CONTENT_PADDING}px`,
  }), [style])
  const {t} = useTranslation()
  return <nav style={reducedContainerStyle}>
    <div style={reducedNavBarStyle}>
      <div style={logoContainerStyle}>
        <Link to={Routes.ROOT}>{isLogoShown ? logoBlue : null}</Link>
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
  </nav>
}
AnonymousNavigationBarBase.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.string,
  ]),
  isLogoShown: PropTypes.bool,
  style: PropTypes.object,
}
const AnonymousNavigationBar = React.memo(AnonymousNavigationBarBase)

const childStyle: React.CSSProperties = {flex: 1, textAlign: 'center'}

const NavigationBarChildren: React.FC<Pick<NavBarProps, 'children'>> =
({children}: Pick<NavBarProps, 'children'>): React.ReactElement => {
  if (!children || typeof children === 'string') {
    return <span style={childStyle}>{children}</span>
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

const onboardingLeftSpaceStyle = {
  flex: `1 1 ${menuStyle.minWidth}px`,
}

const NavigationBarBase: React.FC<NavBarProps> = (props): React.ReactElement => {
  const {children, isLogoShown, isTransparent, page, style} = props
  const {hasBlueBackground, isGuest, isLoggedIn, isOnboardingComplete, project, userName} =
    useNavigationStore()
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
  const isAlpha = useSelector(({user: {featuresEnabled: {alpha} = {}}}: RootState) => !!alpha)
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
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    right: 0,
    top: '100%',
    transition: 'height 100ms',
    zIndex: 2,
  }), [dropDownButtonStyle.backgroundColor, isMenuShown])
  const {t} = useTranslation()
  const {onClick: clickToLogin, to: toLogin} = useLoginLink(undefined, true, 'menu')
  if (!isLoggedIn) {
    return <AnonymousNavigationBar style={containerStyle} isLogoShown={isLogoShown}>
      {children}
    </AnonymousNavigationBar>
  }
  const isDuringOnboarding =
    (page === 'profile' || page === 'new_project') && !isOnboardingComplete
  const isProjectModifiable = project && project.projectId && !project.isIncomplete
  // TODO(cyrille): Unify behavior for menu between Mobile and Desktop.
  return <nav style={containerStyle}>
    <AccountDeletionModal
      isShown={isAccountDeletionModalShown}
      onClose={hideAccountDeletionModal} />
    {isProjectModifiable && project ? <ModifyProjectModal
      isShown={isModifyProjectModalShown}
      onClose={hideModifyProjectModal}
      project={project} /> : null}
    {isDuringOnboarding ? <React.Fragment>
      <span style={onboardingLeftSpaceStyle}></span>
      {isLogoShown ? logo : null}
    </React.Fragment> :
      <div style={logoOnLeftStyle}>
        <Link to={Routes.ROOT}>
          {isLogoShown ? logo : null}
        </Link>
      </div>}

    <NavigationBarChildren>{children}</NavigationBarChildren>

    <OutsideClickHandler onOutsideClick={isMenuShown ? closeMenu : noOp} style={menuStyle}>
      <div>
        <RadiumButton style={dropDownButtonStyle} onClick={toggleMenu}>
          {userName}&nbsp;<div style={{flex: 1}} /><UpDownIcon
            icon="menu"
            isUp={isMenuShown}
            style={desktopMenuIconStyle} />
        </RadiumButton>
        <div style={dropDownStyle} aria-hidden={!isMenuShown}>
          {isGuest ?
            <MenuLink
              style={{fontWeight: 'bold', width: '100%'}} to={toLogin || undefined}
              onClick={clickToLogin} tabIndex={isMenuShown ? 0 : -1}>
              {t('Créer mon compte')}
            </MenuLink> : null}
          <MenuLink to={Routes.PROFILE_PAGE} tabIndex={isMenuShown ? 0 : -1}>
            {t('Mes informations')}
          </MenuLink>
          {isAlpha ? <MenuLink to={Routes.EMAILS_PAGE}>{t('Mes emails')}</MenuLink> : null}
          {isProjectModifiable ?
            <MenuLink onClick={openModifyProjectModal} tabIndex={isMenuShown ? 0 : -1}>
              {t('Modifier mon projet')}
            </MenuLink> : null}
          <MenuLink to={Routes.CONTRIBUTION_PAGE} tabIndex={isMenuShown ? 0 : -1}>
            {t('Contribuer')}
          </MenuLink>
          <MenuLink
            {...helpDeskLinkProps} href="https://aide.bob-emploi.fr/hc/fr"
            tabIndex={isMenuShown ? 0 : -1}>
            {t('Aide')}
          </MenuLink>
          <MenuLink {...helpDeskLinkProps} tabIndex={isMenuShown ? 0 : -1}>
            {t('Nous contacter')}
          </MenuLink>
          {isGuest ? <MenuLink
            onClick={deleteGuest} tabIndex={isMenuShown ? 0 : -1}
            style={{':hover': {color: '#fff'}, 'color': colors.COOL_GREY}}>
            {t('Supprimer mes informations')}
          </MenuLink> : <MenuLink
            onClick={logOut} to={Routes.ROOT} tabIndex={isMenuShown ? 0 : -1}
            style={{':hover': {color: '#fff'}, 'color': colors.COOL_GREY}}>
            {t('Déconnexion')}
          </MenuLink>}
        </div>
      </div>
    </OutsideClickHandler>
  </nav>
}
NavigationBarBase.propTypes = {
  // Allow only one child: it will be part of a flex flow so it can use
  // alignSelf to change its own layout.
  children: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.string,
  ]),
  isLogoShown: PropTypes.bool,
  isTransparent: PropTypes.bool,
  page: PropTypes.string,
  style: PropTypes.object,
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
  onScroll?: () => void
  style?: React.CSSProperties
}

export interface PageWithNavigationBarProps extends ContentProps {
  isChatButtonShown?: boolean
  isCookieDisclaimerShown?: boolean
  isLogoShown?: false
  isNavBarTransparent?: boolean
  navBarContent?: string | JSX.Element
  // A string is handled as a URL to route back to.
  onBackClick?: string | (() => void)
  page?: string
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
  const {children, isContentScrollable, onScroll, style, ...extraProps} = props
  const scrollableDom =
    useRef<HTMLDivElement|HTMLBodyElement>(window.document.body as HTMLBodyElement)
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
      <div
        style={containerStyle} onScroll={onScroll}
        ref={scrollableDom as React.Ref<HTMLDivElement>} {...extraProps}>
        {children}
      </div>
    </div>
  }
  return <div style={containerStyle} {...extraProps}>
    {children}
  </div>
}
const PageContent = React.forwardRef(PageContentBase)
PageContent.propTypes = {
  children: PropTypes.node,
  isContentScrollable: PropTypes.bool,
  onScroll: PropTypes.func,
  style: PropTypes.object,
}

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
    isCookieDisclaimerShown, isLogoShown = true, isNavBarTransparent, navBarContent, onBackClick,
    page, ...extraProps} = props
  useTitleUpdate()
  const [isDebugModalShown, showDebugModal, hideDebugModal] = useModal()
  useKeyListener('KeyE', showDebugModal, {ctrl: true, shift: true})
  return <div style={isContentScrollable ? contentScrollablePageStyle : pageStyle}>
    {isCookieDisclaimerShown ? <CookieMessage style={{flexShrink: 0}} /> : null}
    <BetaMessage style={{flexShrink: 0}} />
    <div style={pageWrapperStyle}>
      <NavigationBar
        page={page} onBackClick={onBackClick} isTransparent={isNavBarTransparent}
        isLogoShown={isLogoShown} style={navBarStyle}>
        {navBarContent}
      </NavigationBar>
      <ChatButton
        isShown={isChatButtonShown && !isMobileVersion}
        domain={config.zendeskDomain} />

      <DebugModal
        onClose={hideDebugModal}
        isShown={isDebugModalShown} />

      <PageContent isContentScrollable={isContentScrollable} ref={ref} {...extraProps} />
    </div>
  </div>
}
const PageWithNavigationBar = React.forwardRef(PageWithNavigationBarBase)
PageWithNavigationBar.propTypes = {
  children: PropTypes.node,
  isChatButtonShown: PropTypes.bool,
  isContentScrollable: PropTypes.bool,
  isCookieDisclaimerShown: PropTypes.bool,
  isLogoShown: PropTypes.bool,
  isNavBarTransparent: PropTypes.bool,
  navBarContent: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.string,
  ]),
  onBackClick: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  onScroll: PropTypes.func,
  page: PropTypes.string,
  style: PropTypes.object,
}
PageWithNavigationBar.defaultProps = {
  isCookieDisclaimerShown: true,
}


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
  const {onClose, project, ...extraProps} = props
  const {t} = useTranslation()
  const dispatch = useDispatch()

  const handleConfirm = useCallback((): void => {
    dispatch(modifyProject(project))
  }, [dispatch, project])
  useFastForward(handleConfirm)

  return <Modal
    style={modalStyle} title={t('Modifier mes informations')} onClose={onClose} {...extraProps}>
    <Trans style={noticeStyle}>
      En modifiant votre projet vous perdrez certains éléments de votre diagnostic actuel.
    </Trans>
    <Trans style={buttonsContainerStyle}>
      <Button type="back" onClick={onClose} isRound={true} style={topBottomStyle}>
        Annuler
      </Button>
      <Button onClick={handleConfirm} isRound={true} style={buttonStyle}>
        Continuer
      </Button>
    </Trans>
  </Modal>
}
ModifyProjectModalBase.propTypes = {
  onClose: PropTypes.func.isRequired,
  project: PropTypes.shape({
    projectId: PropTypes.string.isRequired,
  }),
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
  ...isMobileVersion ? {borderRadius: 13, fontWeight: 'bold'} : {},
  flex: 1,
  margin: '0 auto',
  minWidth: 130,
  padding: '13px 16px',
}

interface FixedNavigationProps {
  children: React.ReactNode
  disabled?: boolean
  navigationPadding?: number
  placeHolderExtraHeight?: number
  onClick?: () => void
  style?: React.CSSProperties
  width?: number
}
const FixedButtonNavigationBase = (props: FixedNavigationProps): React.ReactElement => {
  const {navigationPadding = 30, placeHolderExtraHeight = 0, style, width, ...otherProps} = props
  const navigationStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    padding: navigationPadding,
    ...navigationBaseStyle,
    ...width ? {width} : {},
    ...style,
  }), [navigationPadding, style, width])
  const navigationPlaceholderStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    height: 120 + placeHolderExtraHeight,
  }), [placeHolderExtraHeight])
  return <React.Fragment>
    <div style={navigationStyle}>
      <Button isRound={!isMobileVersion} {...otherProps} style={roundedButtonStyle} />
    </div>
    <div style={navigationPlaceholderStyle} />
  </React.Fragment>
}

FixedButtonNavigationBase.propTypes = {
  children: PropTypes.node,
  // eslint-disable-next-line react/boolean-prop-naming
  disabled: PropTypes.bool,
  navigationPadding: PropTypes.number,
  onClick: PropTypes.func,
  placeHolderExtraHeight: PropTypes.number,
  style: PropTypes.object,
  width: PropTypes.number,
}
const FixedButtonNavigation = React.memo(FixedButtonNavigationBase)

export {FixedButtonNavigation, ModifyProjectModal, PageWithNavigationBar, WithScrollNavBar,
  useTitleUpdate}
