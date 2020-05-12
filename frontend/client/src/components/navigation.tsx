import {TFunction} from 'i18next'
import _memoize from 'lodash/memoize'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {useLocation} from 'react-router'
import {Link} from 'react-router-dom'

import {RootState, logoutAction, modifyProject, noOp, useDispatch} from 'store/actions'
import {getLanguage} from 'store/i18n'
import {onboardingComplete} from 'store/main_selectors'

import bellImage from 'images/bell.svg'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'

import {DebugModal} from 'components/debug'
import {useFastForward} from 'components/fast_forward'
import {Trans} from 'components/i18n'
import {HelpDeskLink} from 'components/help'
import {LoginLink} from 'components/login'
import {AccountDeletionModal} from 'components/logout'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig, useModal} from 'components/modal'
import {RadiumDiv, SmartLink} from 'components/radium'
import {useKeyListener} from 'components/shortkey'
import {Button, ExternalLink, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING, OutsideClickHandler,
  SmoothTransitions, UpDownIcon} from 'components/theme'
import {ZendeskChatButton} from 'components/zendesk'

import {getPageDescription} from '../../release/opengraph_redirect'

import {CookieMessage} from './cookie_message'
import {BetaMessage} from './beta_message'
import {Routes} from './url'

export const NAVIGATION_BAR_HEIGHT = 56

interface Notification {
  href?: string
  onClick?: () => void
  subtitle?: string
  title: React.ReactNode
}

// TODO(cyrille): Maybe drop this altogether.
const getPeNotifs = _memoize((t: TFunction): readonly Notification[] => [
  {
    href: 'https://projects.invisionapp.com/boards/SK39VCS276T8J/',
    subtitle: t(
      'Trouvez ici nos ressources pour présenter {{productName}}',
      {productName: config.productName},
    ),
    title: t('Vous êtes conseiller Pôle emploi\u00A0?'),
  },
])

const emptyArray = [] as const

interface NotificationsProps {
  notifications: readonly Notification[]
  page?: string
}

const notifHeight = 70

const notificationStyle = _memoize((index: number): React.CSSProperties => ({
  alignItems: 'center',
  backgroundColor: '#fff',
  borderTop: index ? `solid 1px ${colors.BACKGROUND_GREY}` : 'initial',
  color: colors.DARK_TWO,
  display: 'flex',
  fontSize: 13,
  height: notifHeight,
  lineHeight: 1.23,
  paddingLeft: 30,
  textDecoration: 'none',
}))

const iconStyle = {
  ':hover': {
    opacity: 1,
  },
  'cursor': 'pointer',
  'opacity': .6,
  'outline': 'none',
  'padding': 15,
  'width': 45,
  'zIndex': 1,
  ...SmoothTransitions,
}

const triangleStyle: React.CSSProperties = {
  borderBottom: 'solid 6px #fff',
  borderLeft: 'solid 6px transparent',
  borderRight: 'solid 6px transparent',
  display: 'inline-block',
}

const chevronIconStyle: React.CSSProperties = {
  fill: colors.CHARCOAL_GREY,
  height: 31,
  marginRight: 20,
  width: 25,
}

const NotificationsBase: React.FC<NotificationsProps> = (props): React.ReactElement|null => {
  const {notifications = emptyArray, page} = props
  const [isExpanded, setIsExpanded] = useState(false)
  const toggleExpanded = useCallback(() => setIsExpanded(wasExpanded => !wasExpanded), [])
  const expandedIconStyle: React.CSSProperties = useMemo(() => ({
    ...iconStyle,
    ...isExpanded && {opacity: 1},
  }), [isExpanded])
  const containerStyle: React.CSSProperties = useMemo(() => ({
    maxHeight: isExpanded ? 'initial' : 0,
    opacity: isExpanded ? 1 : 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 150,
    top: '100%',
    width: 380,
    ...SmoothTransitions,
  }), [isExpanded])
  const triangleContainerStyle: React.CSSProperties = useMemo(() => ({
    bottom: 0,
    lineHeight: '6px',
    opacity: isExpanded ? 1 : 0,
    position: 'absolute',
    textAlign: 'center',
    width: iconStyle.width,
    ...SmoothTransitions,
  }), [isExpanded])
  // TODO(sil): Allows each page to send its notifications.
  if (!notifications.length || page !== 'project') {
    return null
  }
  return <RadiumDiv
    // TODO(cyrille): Fix link click.
    onBlur={isExpanded ? toggleExpanded : undefined}
    style={{alignItems: 'center', display: 'flex', width: iconStyle.width}}>
    <img
      src={bellImage} style={expandedIconStyle} tabIndex={0}
      onClick={toggleExpanded}
      alt="notifications" />

    <div style={triangleContainerStyle}>
      <div style={triangleStyle} />
    </div>

    <div style={containerStyle}>
      {notifications.map(({href, onClick, subtitle, title}, index): React.ReactNode => <ExternalLink
        key={`notif-${index}`} style={notificationStyle(index)}
        href={href} onClick={onClick}>
        <div>
          <strong>{title}</strong>
          {subtitle ? <div>{subtitle}</div> : null}
        </div>
        <span style={{flex: 1}} />
        <ChevronRightIcon style={chevronIconStyle} />
      </ExternalLink>)}
    </div>
  </RadiumDiv>
}
NotificationsBase.propTypes = {
  notifications: PropTypes.arrayOf(PropTypes.shape({
    href: PropTypes.string,
    onClick: PropTypes.func,
    subtitle: PropTypes.string,
    title: PropTypes.node.isRequired,
  }).isRequired),
  page: PropTypes.string,
}
const Notifications = React.memo(NotificationsBase)


const whiteTextStyle = {color: '#fff'} as const
const lightBlueTextStyle = {color: colors.VERY_LIGHT_BLUE} as const
const navLinkStyle: React.CSSProperties = {
  ...lightBlueTextStyle,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  padding: '20px 25px 21px',
  textTransform: 'uppercase',
}


type LinkProps = GetProps<typeof SmartLink> & {
  isOnTransparentBar?: boolean
  isSelected?: boolean
}


const NavigationLinkBase: React.FC<LinkProps> = (props: LinkProps): React.ReactElement => {
  const {children, isOnTransparentBar, isSelected, style, ...extraProps} = props
  const containerStyle: RadiumCSSProperties = useMemo((): RadiumCSSProperties => ({
    ':focus': isOnTransparentBar ? lightBlueTextStyle : whiteTextStyle,
    ':hover': isOnTransparentBar ? lightBlueTextStyle : whiteTextStyle,
    ...navLinkStyle,
    ...(!isOnTransparentBar !== !isSelected) && whiteTextStyle,
    'cursor': 'pointer',
    'position': 'relative',
    'textDecoration': 'none',
    ...SmoothTransitions,
    ...style,
  }), [isOnTransparentBar, isSelected, style])
  return <SmartLink style={containerStyle} {...extraProps}>
    {children}
  </SmartLink>
}
NavigationLinkBase.propTypes = {
  children: PropTypes.node,
  isOnTransparentBar: PropTypes.bool,
  isSelected: PropTypes.bool,
  style: PropTypes.object,
  to: PropTypes.string,
}
const NavigationLink = React.memo(NavigationLinkBase)


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
const MenuLinkBase: React.FC<GetProps<typeof SmartLink>> =
({style, ...extraProps}: GetProps<typeof SmartLink>): React.ReactElement => {
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
  return <SmartLink {...extraProps} style={containerStyle} />
}
MenuLinkBase.propTypes = {
  children: PropTypes.node,
  href: PropTypes.string,
  style: PropTypes.object,
  to: PropTypes.string,
}
const MenuLink = React.memo(MenuLinkBase)


interface NavBarConnectedProps {
  featuresEnabled: bayes.bob.Features
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

const menuIconStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fill: '#fff',
  height: 50,
  justifyContent: 'center',
  left: 0,
  opacity: 1,
  padding: 15,
  position: 'absolute',
  top: 0,
  width: 50,
}

const otherPageLinkStyle: React.CSSProperties = {
  color: 'inherit',
  display: 'block',
  padding: '20px 40px',
  textDecoration: 'none',
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
  featuresEnabled: user.featuresEnabled || {},
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
  const closeMenuTimeout = useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  useEffect((): (() => void) => (): void => {
    if (closeMenuTimeout.current) {
      clearTimeout(closeMenuTimeout.current)
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
    closeMenuTimeout.current = setTimeout((): void => setIsMenuShown(false), 50)
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
  const {isGuest, isLoggedIn, project} = useNavigationStore()
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
    backgroundColor: colors.BOB_BLUE,
    color: isMenuShown ? 'inherit' : '#fff',
    display: 'flex',
    height: 50,
    justifyContent: 'center',
    position: 'relative',
  }), [isMenuShown])
  const menuCloseIconStyle = useMemo((): React.CSSProperties => ({
    ...menuIconStyle,
    ...isMenuShown && {opacity: 0.5},
    fill: colors.DARK_TWO,
  }), [isMenuShown])
  const menuMenuIconStyle = useMemo((): React.CSSProperties => ({
    ...menuIconStyle,
    ...isMenuShown && {opacity: 0.5},
  }), [isMenuShown])
  const {t} = useTranslation()
  const linkStyle = (otherPage: string): React.CSSProperties =>
    otherPage === page ? currentPageLinkStyle : otherPageLinkStyle
  const isProjectModifiable = project && project.projectId && !project.isIncomplete
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
            <CloseIcon
              onClick={toggleMenu}
              style={menuCloseIconStyle}
            />
            {isLoggedIn ? <React.Fragment>
              {isGuest ? <LoginLink visualElement="menu" style={linkStyle('login')} isSignUp={true}>
                {t('Créer mon compte')}
              </LoginLink> : null}
              {isProjectModifiable ? <a
                style={otherPageLinkStyle}
                onClick={openModifyProjectModal}>
                {t('Modifier mon projet')}
              </a> : null}
              <Link
                to={Routes.PROFILE_PAGE}
                style={linkStyle('profile')}>
                {t('Mes informations')}
              </Link>
              <HelpDeskLink style={otherPageLinkStyle}>Nous contacter</HelpDeskLink>
              {isGuest ? <SmartLink
                style={otherPageLinkStyle}
                onClick={deleteGuest}>
                {t('Supprimer mes informations')}
              </SmartLink> :
                <Link to={Routes.ROOT} style={otherPageLinkStyle} onClick={logOut}>
                  {t('Déconnexion')}
                </Link>}
            </React.Fragment> : <React.Fragment>
              <Link to={Routes.ROOT} style={linkStyle('landing')}>
                {t('Accueil')}
              </Link>
              <LoginLink style={linkStyle('login')} visualElement="menu">
                {t('Se connecter')}
              </LoginLink>
            </React.Fragment>}
          </div>
        </OutsideClickHandler>
      </React.Fragment>
      // Don't show a menu if we can go back.
      : onBackClick ? null : <MenuIcon
        name="menu" style={menuMenuIconStyle} tabIndex={0}
        onClick={toggleMenu} />
    }
    {/* TODO(cyrille): Make sure text is centered vertically here. */}
    {children || (isLogoShown ? <Link to={Routes.ROOT}>
      <img src={logoProductWhiteImage} alt={config.productName} style={{height: 22}} />
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

const logo = <img src={logoProductWhiteImage} style={{height: 25}} alt={config.productName} />

type AnonymousNavBarProps = Pick<NavBarProps, 'isLogoShown'|'isTransparent'|'style'|'children'>

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
  const {children, isLogoShown, isTransparent, style} = props
  const reducedContainerStyle = useMemo((): React.CSSProperties => ({
    ...style,
    display: 'block',
    padding: `0 ${MIN_CONTENT_PADDING}px`,
  }), [style])
  const {t} = useTranslation()
  return <nav style={reducedContainerStyle}>
    <div style={reducedNavBarStyle}>
      <div style={logoContainerStyle}>
        <Link to={Routes.ROOT}>{isLogoShown ? logo : null}</Link>
      </div>

      {children}

      <LoginLink visualElement="navbar">
        <div style={connectContainerStyle}>
          <NavigationLink
            isOnTransparentBar={isTransparent}
            style={{padding: '20px 0 21px 25px'}}>
            {t('Se connecter')}
          </NavigationLink>
        </div>
      </LoginLink>
    </div>
  </nav>
}
AnonymousNavigationBarBase.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.string,
  ]),
  isLogoShown: PropTypes.bool,
  isTransparent: PropTypes.bool,
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
  const {featuresEnabled, isGuest, isLoggedIn, isOnboardingComplete, project,
    userName} = useNavigationStore()
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
    backgroundColor: isTransparent ? 'initial' : colors.BOB_BLUE,
    color: '#fff',
    display: 'flex',
    height: NAVIGATION_BAR_HEIGHT * (isTransparent ? 1.5 : 1),
    justifyContent: 'flex-end',
    position: isTransparent ? 'absolute' : 'relative',
    width: '100%',
    zIndex: isTransparent ? 2 : 'initial',
    ...style,
  }), [isTransparent, style])
  const dropDownButtonStyle = useMemo((): RadiumCSSProperties => ({
    ':focus': {
      backgroundColor: '#fff',
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
  if (!isLoggedIn) {
    return <AnonymousNavigationBar style={containerStyle} {...{isLogoShown, isTransparent}}>
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

    <Notifications
      page={page}
      notifications={featuresEnabled.poleEmploi ? getPeNotifs(t) : emptyArray} />

    <OutsideClickHandler
      onOutsideClick={isMenuShown ? closeMenu : noOp} style={menuStyle}
      onClick={toggleMenu} tabIndex={0}>
      <div>
        <RadiumDiv style={dropDownButtonStyle}>
          {userName}&nbsp;<div style={{flex: 1}} /><UpDownIcon
            icon="menu"
            isUp={isMenuShown}
            style={desktopMenuIconStyle} />
        </RadiumDiv>
        <div style={dropDownStyle}>
          {isGuest ?
            <LoginLink visualElement="menu" isSignUp={true} style={{textDecoration: 'none'}}>
              <MenuLink style={{fontWeight: 'bold'}}>
                {t('Créer mon compte')}
              </MenuLink>
            </LoginLink> : null}
          <MenuLink to={Routes.PROFILE_PAGE}>{t('Mes informations')}</MenuLink>
          {isProjectModifiable ?
            <MenuLink onClick={openModifyProjectModal}>
              {t('Modifier mon projet')}
            </MenuLink> : null}
          <MenuLink to={Routes.CONTRIBUTION_PAGE}>{t('Contribuer')}</MenuLink>
          <HelpDeskLink href="https://aide.bob-emploi.fr/hc/fr">
            <MenuLink>{t('Aide')}</MenuLink>
          </HelpDeskLink>
          <HelpDeskLink><MenuLink>{t('Nous contacter')}</MenuLink></HelpDeskLink>
          {isGuest ? <MenuLink
            onClick={deleteGuest}
            style={{':hover': {color: '#fff'}, 'color': colors.COOL_GREY}}>
            {t('Supprimer mes informations')}
          </MenuLink> : <MenuLink
            onClick={logOut} to={Routes.ROOT}
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
  useEffect(() => {
    const {description, title} = getPageDescription((basename + pathname).slice(1))
    // Update the title.
    for (const titleElement of document.getElementsByTagName('title')) {
      titleElement.textContent = title
    }

    // Update the description.
    for (const metaElement of document.getElementsByTagName('meta')) {
      if (metaElement.getAttribute('name') === 'description') {
        metaElement.setAttribute('content', description || '')
      }
    }
  }, [basename, pathname])
}


type ChatButtonProps = Omit<GetProps<typeof ZendeskChatButton>, 'language' | 'user'>
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
  isLogoShown?: boolean
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
    isCookieDisclaimerShown, isLogoShown, isNavBarTransparent, navBarContent, onBackClick,
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
  isLogoShown: true,
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


export {ModifyProjectModal, PageWithNavigationBar, useTitleUpdate}
