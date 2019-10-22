import _memoize from 'lodash/memoize'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {connect} from 'react-redux'
import {useLocation} from 'react-router'
import {Link} from 'react-router-dom'

import {DispatchAllActions, RootState, logoutAction, modifyProject, noOp} from 'store/actions'
import {YouChooser} from 'store/french'
import {onboardingComplete} from 'store/main_selectors'
import {youForUser} from 'store/user'

import bellImage from 'images/bell.svg'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'
import logoProductBetaImage from 'images/logo-bob-beta.svg'

import {DebugModal} from 'components/debug'
import {FastForward} from 'components/fast_forward'
import {HelpDeskLink} from 'components/help'
import {LoginLink} from 'components/login'
import {AccountDeletionModal} from 'components/logout'
import {isMobileVersion} from 'components/mobile'
import {Modal, ModalConfig} from 'components/modal'
import {RadiumDiv, SmartLink, SmartLinkProps} from 'components/radium'
import {ShortKey} from 'components/shortkey'
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
const getPeNotifs = _memoize((userYou): readonly Notification[] => [
  {
    href: 'https://projects.invisionapp.com/boards/SK39VCS276T8J/',
    subtitle: `Trouve${userYou('', 'z')} ici nos resources` +
      `pour présenter ${config.productName}`,
    title: `${userYou('Tu es', 'Vous êtes')} conseiller Pôle emploi ?`,
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
  cursor: 'pointer',
  opacity: .6,
  outline: 'none',
  padding: 15,
  width: 45,
  zIndex: 1,
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
  // TODO(Marie Laure): Allows each page to send its notifications.
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


interface LinkProps {
  children?: React.ReactNode
  href?: string
  isOnTransparentBar?: boolean
  isSelected?: boolean
  onClick?: () => void
  selectionStyle?: 'bottom' | 'top'
  style?: React.CSSProperties
  to?: string
}


const selectMarkStyle: React.CSSProperties = {
  backgroundColor: colors.RED_PINK,
  borderRadius: '3px 3px 0 0',
  bottom: 0,
  height: 4,
  left: '35%',
  position: 'absolute',
  width: '30%',
}

const selectMarkOnTopStyle: React.CSSProperties = {
  ...selectMarkStyle,
  borderRadius: '0 0 3px 3px',
  bottom: 'initial',
  top: 0,
}

const NavigationLinkBase: React.FC<LinkProps> = (props: LinkProps): React.ReactElement => {
  const {children, isOnTransparentBar, isSelected, selectionStyle, style, ...extraProps} = props
  const markStyle = selectionStyle === 'top' ? selectMarkOnTopStyle : selectMarkStyle
  const containerStyle: RadiumCSSProperties = useMemo((): RadiumCSSProperties => ({
    ':focus': isOnTransparentBar ? lightBlueTextStyle : whiteTextStyle,
    ':hover': isOnTransparentBar ? lightBlueTextStyle : whiteTextStyle,
    ...navLinkStyle,
    ...(!isOnTransparentBar !== !isSelected) && whiteTextStyle,
    cursor: 'pointer',
    position: 'relative',
    textDecoration: 'none',
    ...SmoothTransitions,
    ...style,
  }), [isOnTransparentBar, isSelected, style])
  return <SmartLink style={containerStyle} {...extraProps}>
    {children}
    {(isSelected && selectionStyle) ? <div style={markStyle} /> : null}
  </SmartLink>
}
NavigationLinkBase.propTypes = {
  children: PropTypes.node,
  isOnTransparentBar: PropTypes.bool,
  isSelected: PropTypes.bool,
  selectionStyle: PropTypes.oneOf(['bottom', 'top']),
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
const MenuLinkBase: React.FC<SmartLinkProps> =
({style, ...extraProps}: SmartLinkProps): React.ReactElement => {
  const containerStyle = useMemo(() => ({
    ...menuLinkStyle,
    ...style,
    ':focus': {
      ...menuLinkHoverStyle,
      ...style ? style['hover'] : {},
    },
    ':hover': {
      ...menuLinkHoverStyle,
      ...style ? style['hover'] : {},
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
  userYou: YouChooser
}

interface NavBarProps extends NavBarConnectedProps {
  areNavLinksShown: boolean
  children?: string | React.ReactElement<{style?: React.CSSProperties}>
  dispatch: DispatchAllActions
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

const useNavigation = (dispatch: DispatchAllActions): ModalHooks => {
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
  const {children, dispatch, isGuest, isLoggedIn, isLogoShown, onBackClick, page, project} = props
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
  } = useNavigation(dispatch)
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
                Créer mon compte
              </LoginLink> : null}
              {isProjectModifiable ? <a
                style={otherPageLinkStyle}
                onClick={openModifyProjectModal}>
                Modifier mon projet
              </a> : null}
              <Link
                to={Routes.PROFILE_PAGE}
                style={linkStyle('profile')}>
                Mes informations
              </Link>
              <HelpDeskLink style={otherPageLinkStyle}>Nous contacter</HelpDeskLink>
              {isGuest ? <SmartLink
                style={otherPageLinkStyle}
                onClick={deleteGuest}>
                Supprimer mes informations
              </SmartLink> :
                <Link to={Routes.ROOT} style={otherPageLinkStyle} onClick={logOut}>
                  Déconnexion
                </Link>}
            </React.Fragment> : <React.Fragment>
              <Link to={Routes.ROOT} style={linkStyle('landing')}>
                Accueil
              </Link>
              <Link to={Routes.VISION_PAGE} style={linkStyle('vision')}>
                Notre mission
              </Link>
              <Link to={Routes.TEAM_PAGE} style={linkStyle('equipe')}>
                Qui est {config.productName}&nbsp;?
              </Link>
              <Link to={Routes.TRANSPARENCY_PAGE} style={linkStyle('transparency')}>
                Où en sommes-nous&nbsp;?
              </Link>
              <LoginLink style={linkStyle('login')} visualElement="menu">
                Se connecter
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
  dispatch: PropTypes.func.isRequired,
  featuresEnabled: PropTypes.shape({
    poleEmploi: PropTypes.bool,
  }).isRequired,
  isGuest: PropTypes.bool.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  isLogoShown: PropTypes.bool,
  // A string is handled as a relative URL to route back to.
  onBackClick: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  page: PropTypes.string,
  project: PropTypes.shape({
    isIncomplete: PropTypes.bool,
    projectId: PropTypes.string,
  }),
}

const logo = <img src={logoProductBetaImage} style={{height: 30}} alt={config.productName} />

type AnonymousNavBarProps =
  Pick<NavBarProps, 'areNavLinksShown' | 'isLogoShown' | 'isTransparent' | 'page' | 'style'>

const reducedNavBarStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  height: NAVIGATION_BAR_HEIGHT,
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
  const {areNavLinksShown, isLogoShown, isTransparent, page, style} = props
  const reducedContainerStyle = useMemo((): React.CSSProperties => ({
    ...style,
    display: 'block',
    padding: `0 ${MIN_CONTENT_PADDING}px`,
  }), [style])
  return <nav style={reducedContainerStyle}>
    <div style={reducedNavBarStyle}>
      <div style={logoContainerStyle}>
        <Link to={Routes.ROOT}>{isLogoShown ? logo : null}</Link>
      </div>

      {areNavLinksShown ? <React.Fragment>
        <NavigationLink
          to={Routes.VISION_PAGE} isSelected={page === 'vision'} selectionStyle="top"
          isOnTransparentBar={isTransparent}>
          Notre mission
        </NavigationLink>
        <NavigationLink
          to={Routes.TEAM_PAGE} isSelected={page === 'equipe'} selectionStyle="top"
          isOnTransparentBar={isTransparent}>
          Qui est {config.productName}&nbsp;?
        </NavigationLink>
        <NavigationLink
          to={Routes.TRANSPARENCY_PAGE} isSelected={page === 'transparency'}
          selectionStyle="top" isOnTransparentBar={isTransparent}>
          Où en sommes-nous&nbsp;?
        </NavigationLink>
      </React.Fragment> : null}

      <LoginLink visualElement="navbar">
        <div style={connectContainerStyle}>
          <NavigationLink
            isOnTransparentBar={isTransparent}
            style={{padding: '20px 0 21px 25px'}}>
            Se connecter
          </NavigationLink>
        </div>
      </LoginLink>
    </div>
  </nav>
}
AnonymousNavigationBarBase.propTypes = {
  areNavLinksShown: PropTypes.bool.isRequired,
  isLogoShown: PropTypes.bool,
  isTransparent: PropTypes.bool,
  page: PropTypes.string,
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
  const {areNavLinksShown, children, dispatch, featuresEnabled, isGuest, isLoggedIn, isLogoShown,
    isOnboardingComplete, isTransparent, page, project, style, userName, userYou} = props
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
  } = useNavigation(dispatch)
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: isTransparent ? 'initial' : colors.BOB_BLUE,
    color: '#fff',
    display: 'flex',
    height: NAVIGATION_BAR_HEIGHT,
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
    alignItems: 'center',
    backgroundColor: isMenuShown ? '#fff' : 'initial',
    bottom: 0,
    color: isMenuShown ? colors.DARK_TWO : '#fff',
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    padding: 25,
    position: 'absolute',
    right: 0,
    top: 0,
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
  if (!isLoggedIn) {
    return <AnonymousNavigationBar
      style={containerStyle} {...{areNavLinksShown, isLogoShown, isTransparent, page}} />
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
      notifications={featuresEnabled.poleEmploi ? getPeNotifs(userYou) : emptyArray} />

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
                Créer mon compte
              </MenuLink>
            </LoginLink> : null}
          <MenuLink to={Routes.PROFILE_PAGE}>Mes informations</MenuLink>
          {isProjectModifiable ?
            <MenuLink onClick={openModifyProjectModal}>
              Modifier mon projet
            </MenuLink> : null}
          <MenuLink to={Routes.CONTRIBUTION_PAGE}>Contribuer</MenuLink>
          <HelpDeskLink href="https://aide.bob-emploi.fr/hc/fr">
            <MenuLink>Aide</MenuLink>
          </HelpDeskLink>
          <HelpDeskLink><MenuLink>Nous contacter</MenuLink></HelpDeskLink>
          {isGuest ? <MenuLink
            onClick={deleteGuest}
            style={{':hover': {color: '#fff'}, color: colors.COOL_GREY}}>
            Supprimer mes informations
          </MenuLink> : <MenuLink
            onClick={logOut} to={Routes.ROOT}
            style={{':hover': {color: '#fff'}, color: colors.COOL_GREY}}>
            Déconnexion
          </MenuLink>}
        </div>
      </div>
    </OutsideClickHandler>
  </nav>
}
NavigationBarBase.propTypes = {
  areNavLinksShown: PropTypes.bool.isRequired,
  // Allow only one child: it will be part of a flex flow so it can use
  // alignSelf to change its own layout.
  children: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.string,
  ]),
  dispatch: PropTypes.func.isRequired,
  featuresEnabled: PropTypes.shape({
    poleEmploi: PropTypes.bool,
  }).isRequired,
  isGuest: PropTypes.bool.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  isLogoShown: PropTypes.bool,
  isOnboardingComplete: PropTypes.bool,
  isTransparent: PropTypes.bool,
  page: PropTypes.string,
  project: PropTypes.shape({
    isIncomplete: PropTypes.bool,
    projectId: PropTypes.string,
  }),
  style: PropTypes.object,
  userName: PropTypes.string,
  userYou: PropTypes.func.isRequired,
}
const NavigationBar = connect(({user}: RootState): NavBarConnectedProps => ({
  featuresEnabled: user.featuresEnabled || {},
  isGuest: !user.hasAccount,
  isLoggedIn: !!(user.profile && user.profile.name),
  isOnboardingComplete: onboardingComplete(user),
  project: user.projects && user.projects[0],
  userName: user.profile && user.profile.name,
  userYou: youForUser(user),
}))(React.memo(isMobileVersion ? MobileNavigationBarBase : NavigationBarBase))


// Hook that listens to location changes (from React Router) and
// updates the HTML title and meta description.
const useTitleUpdate = (): void => {
  const {pathname} = useLocation()
  useEffect(() => {
    const {description, title} = getPageDescription(pathname.slice(1))

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
  }, [pathname])
}


const ConnectedZendeskChatButton =
  connect(
    ({user: {profile}}: RootState): {user?: bayes.bob.UserProfile} => ({user: profile})
  )(ZendeskChatButton)



export interface Scrollable {
  scroll: (options) => void
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
  areNavLinksShown?: boolean
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
(props: ContentProps, ref: React.RefObject<Scrollable>): React.ReactElement => {
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
  const scroll = useCallback((options): void => {
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
(props: PageWithNavigationBarProps, ref: React.RefObject<Scrollable>): React.ReactElement => {
  const {areNavLinksShown, isChatButtonShown, isContentScrollable,
    isCookieDisclaimerShown, isLogoShown, isNavBarTransparent, navBarContent, onBackClick,
    page, ...extraProps} = props
  useTitleUpdate()
  const [isDebugModalShown, setIsDebugModalShown] = useState(false)
  const showDebugModal = useCallback(() => setIsDebugModalShown(true), [])
  const hideDebugModal = useCallback(() => setIsDebugModalShown(false), [])
  return <div style={isContentScrollable ? contentScrollablePageStyle : pageStyle}>
    {isCookieDisclaimerShown ? <CookieMessage style={{flexShrink: 0}} /> : null}
    <BetaMessage style={{flexShrink: 0}} />
    <div style={pageWrapperStyle}>
      <NavigationBar
        page={page} onBackClick={onBackClick} isTransparent={isNavBarTransparent}
        isLogoShown={isLogoShown} style={navBarStyle} areNavLinksShown={!!areNavLinksShown}>
        {navBarContent}
      </NavigationBar>
      <ConnectedZendeskChatButton
        isShown={isChatButtonShown && !isMobileVersion} language="fr"
        domain={config.zendeskDomain} />

      <ShortKey
        keyCode="KeyE" hasCtrlModifier={true} hasShiftModifier={true}
        onKeyUp={showDebugModal} />
      <DebugModal
        onClose={hideDebugModal}
        isShown={isDebugModalShown} />

      <PageContent isContentScrollable={isContentScrollable} ref={ref} {...extraProps} />
    </div>
  </div>
}
const PageWithNavigationBar = React.forwardRef(PageWithNavigationBarBase)
PageWithNavigationBar.propTypes = {
  areNavLinksShown: PropTypes.bool,
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
  areNavLinksShown: true,
  isCookieDisclaimerShown: true,
  isLogoShown: true,
}


interface ModifyProjectModalProps extends Omit<ModalConfig, 'children'> {
  dispatch: DispatchAllActions
  project: bayes.bob.Project
}


class ModifyProjectModalBase extends React.PureComponent<ModifyProjectModalProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    project: PropTypes.shape({
      projectId: PropTypes.string.isRequired,
    }),
  }

  private handleConfirm = (): void => {
    const {dispatch, project} = this.props
    dispatch(modifyProject(project))
  }

  public render(): React.ReactNode {
    const {dispatch: omittedDispatch, onClose, project: omittedProject, ...extraProps} = this.props
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
    return <Modal
      style={modalStyle} title="Modifier mes informations" onClose={onClose} {...extraProps}>
      <FastForward onForward={this.handleConfirm} />
      <div style={noticeStyle}>
        En modifiant votre projet vous perdrez certains éléments de votre diagnostic actuel.
      </div>
      <div style={buttonsContainerStyle}>
        <Button type="back" onClick={onClose} isRound={true} style={topBottomStyle}>
          Annuler
        </Button>
        <Button onClick={this.handleConfirm} isRound={true} style={buttonStyle}>
          Continuer
        </Button>
      </div>
    </Modal>
  }
}
const ModifyProjectModal = connect()(ModifyProjectModalBase)


export {ModifyProjectModal, PageWithNavigationBar}
