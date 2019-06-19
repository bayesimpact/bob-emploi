import _memoize from 'lodash/memoize'
import AccountCircleIcon from 'mdi-react/AccountCircleIcon'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import {Link} from 'react-router-dom'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, logoutAction, modifyProject,
  openLoginModal} from 'store/actions'
import {YouChooser} from 'store/french'
import {onboardingComplete} from 'store/main_selectors'
import {youForUser} from 'store/user'

import bellImage from 'images/bell.svg'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'
import logoProductBetaImage from 'images/logo-bob-beta.svg'

import {DebugModal} from 'components/debug'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {RadiumLink} from 'components/radium'
import {ShortKey} from 'components/shortkey'
import {Modal, ModalConfig} from 'components/modal'
import {ZendeskChatButton} from 'components/zendesk'

import {getPageDescription} from '../../release/opengraph_redirect'

import {CookieMessage} from './cookie_message'
import {BetaMessage} from './beta_message'
import {Button, ExternalLink, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING,
  OutsideClickHandler, SmoothTransitions, UpDownIcon} from './theme'
import {Routes} from './url'

export const NAVIGATION_BAR_HEIGHT = 56


const openHelpDeskUrl = (): void => {
  window.open(config.helpRequestUrl, '_blank')
}

const noOp = (): void => {}


interface NotificationsProps {
  notifications: {
    href?: string
    onClick?: () => void
    subtitle?: string
    title: React.ReactNode
  }[]
  page?: string
}


interface NotificationsState {
  isExpanded?: boolean
  isHovered?: boolean
}


class Notifications extends React.PureComponent<NotificationsProps, NotificationsState> {
  public static propTypes= {
    notifications: PropTypes.arrayOf(PropTypes.shape({
      href: PropTypes.string,
      onClick: PropTypes.func,
      subtitle: PropTypes.string,
      title: PropTypes.node.isRequired,
    }).isRequired),
    page: PropTypes.string,
  }

  public state = {
    isExpanded: false,
    isHovered: false,
  }

  private handleSetExpanded = _memoize((isExpanded: boolean): (() => void) =>
    (): void => this.setState({isExpanded}))

  private handleSetHovered = _memoize((isHovered: boolean): (() => void) =>
    (): void => this.setState({isHovered}))

  public render(): React.ReactNode {
    const {notifications, page} = this.props
    const {isExpanded, isHovered} = this.state
    // TODO(Marie Laure): Allows each page to send its notifications.
    if (!notifications || !notifications.length || page !== 'project') {
      return null
    }
    const notifHeight = 70
    const iconStyle: React.CSSProperties = {
      cursor: 'pointer',
      opacity: (isExpanded || isHovered) ? 1 : .6,
      outline: 'none',
      padding: 15,
      width: 45,
      zIndex: 1,
      ...SmoothTransitions,
    }
    const containerStyle: React.CSSProperties = {
      maxHeight: isExpanded ? ((notifHeight + 1) * notifications.length) : 0,
      opacity: isExpanded ? 1 : 0,
      overflow: 'hidden',
      position: 'absolute',
      right: 150,
      top: '100%',
      width: 380,
      ...SmoothTransitions,
    }
    const notificationStyle = (index: number): React.CSSProperties => ({
      alignItems: 'center',
      backgroundColor: '#fff',
      borderTop: index ? `solid 1px ${colors.BACKGROUND_GREY}` : 'initial',
      color: colors.DARK_TWO,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: notifHeight,
      lineHeight: 1.23,
      paddingLeft: 30,
    })
    const triangleContainerStyle: React.CSSProperties = {
      bottom: 0,
      lineHeight: '6px',
      opacity: isExpanded ? 1 : 0,
      position: 'absolute',
      textAlign: 'center',
      width: iconStyle.width,
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
    return <div
      onBlur={this.handleSetExpanded(false)}
      onMouseOver={this.handleSetHovered(true)}
      onMouseLeave={this.handleSetHovered(false)}
      style={{alignItems: 'center', display: 'flex', width: iconStyle.width}}>
      <img
        src={bellImage} style={iconStyle} tabIndex={0}
        onClick={this.handleSetExpanded(true)}
        alt="notifications" />

      <div style={triangleContainerStyle}>
        <div style={triangleStyle} />
      </div>

      <div style={containerStyle}>
        {/* TODO(pascal): Fix arrow function in props below, and fix lint rule. */}
        {notifications.map(({href, onClick, subtitle, title}, index): React.ReactNode => <div
          key={`notif-${index}`} style={notificationStyle(index)}
          onClick={onClick || ((): void => {
            window.open(href, '_blank')
          })}>
          <div>
            <strong>{title}</strong>
            {subtitle ? <div>{subtitle}</div> : null}
          </div>
          <span style={{flex: 1}} />
          <ChevronRightIcon style={chevronIconStyle} />
        </div>)}
      </div>
    </div>
  }
}


const navLinkStyle = {
  color: colors.VERY_LIGHT_BLUE,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  padding: '20px 25px 21px',
  textTransform: 'uppercase',
}


interface LinkProps {
  isOnTransparentBar?: boolean
  isSelected?: boolean
  onClick?: () => void
  selectionStyle?: 'bottom' | 'top'
  style?: React.CSSProperties
  to?: string
}


interface LinkState {
  isFocused?: boolean
  isHovered?: boolean
}


class NavigationLink extends React.PureComponent<LinkProps, LinkState> {
  public static propTypes = {
    children: PropTypes.node,
    isOnTransparentBar: PropTypes.bool,
    isSelected: PropTypes.bool,
    selectionStyle: PropTypes.oneOf(['bottom', 'top']),
    style: PropTypes.object,
    to: PropTypes.string,
  }

  public state = {
    isFocused: false,
    isHovered: false,
  }

  private handleSetFocused = _memoize((isFocused: boolean): (() => void) =>
    (): void => this.setState({isFocused}))

  private handleSetHovered = _memoize((isHovered: boolean): (() => void) =>
    (): void => this.setState({isHovered}))

  public render(): React.ReactNode {
    const {children, isOnTransparentBar, isSelected, selectionStyle, style, to,
      ...extraProps} = this.props
    const {isFocused, isHovered} = this.state
    const isHighlighted = isSelected || isHovered || isFocused
    const isSelectionOnTop = selectionStyle === 'top'
    const containerStyle: React.CSSProperties = {
      ...navLinkStyle,
      color: isOnTransparentBar ?
        ((isSelected || !isHovered && !isFocused) ? '#fff' : navLinkStyle.color) :
        (isHighlighted ? '#fff' : navLinkStyle.color),
      cursor: 'pointer',
      position: 'relative',
      textDecoration: 'none',
      ...SmoothTransitions,
      ...style,
      ...(isHighlighted && style && style[':highlight'] || null),
    }
    const selectMarkStyle: React.CSSProperties = {
      backgroundColor: colors.RED_PINK,
      borderRadius: isSelectionOnTop ? '0 0 3px 3px' : '3px 3px 0 0',
      bottom: isSelectionOnTop ? 'initial' : 0,
      height: 4,
      left: '35%',
      position: 'absolute',
      top: isSelectionOnTop ? 0 : 'initial',
      width: '30%',
    }
    const props = {
      ...extraProps,
      onBlur: this.handleSetFocused(false),
      onFocus: this.handleSetFocused(true),
      onMouseLeave: this.handleSetHovered(false),
      onMouseOver: this.handleSetHovered(true),
      style: containerStyle,
    }
    if (to) {
      return <Link {...props} to={to}>
        {children}
        {(isSelected && selectionStyle) ? <div style={selectMarkStyle} /> : null}
      </Link>
    }
    return <a {...props}>
      {children}
      {(isSelected && selectionStyle) ? <div style={selectMarkStyle} /> : null}
    </a>
  }
}


const MENU_LINK_HEIGHT = 50


const RadiumDiv = Radium(
  (props): React.ReactElement<React.HTMLProps<HTMLDivElement>> => <div {...props} />
)
const RadiumExternalLink = Radium(ExternalLink)


interface MenuLinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'ref' | 'style'> {
  style?: RadiumCSSProperties
  to?: string
}


class MenuLink extends React.PureComponent<MenuLinkProps> {
  public static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
    to: PropTypes.string,
  }

  public render(): React.ReactNode {
    const {children, style, to, ...extraProps} = this.props
    const containerStyle: RadiumCSSProperties = {
      alignItems: 'center',
      color: colors.DARK_TWO,
      display: 'flex',
      fontWeight: 'normal',
      height: MENU_LINK_HEIGHT,
      paddingLeft: 25,
      textAlign: 'left',
      textDecoration: 'none',
      ...style,
      ':focus': {
        backgroundColor: colors.BOB_BLUE,
        color: '#fff',
        ...(style && style[':hover'] || {}),
      },
      ':hover': {
        backgroundColor: colors.BOB_BLUE,
        color: '#fff',
        ...(style && style[':hover'] || {}),
      },
    }
    if (to) {
      return <RadiumLink {...extraProps} to={to} style={containerStyle}>
        {children}
      </RadiumLink>
    }
    return <RadiumExternalLink {...extraProps} style={containerStyle}>
      {children}
    </RadiumExternalLink>
  }
}


interface NavBarConnectedProps {
  featuresEnabled: bayes.bob.Features
  isLoggedIn: boolean
  isOnboardingComplete: boolean
  project: bayes.bob.Project
  userName: string
  userYou: YouChooser
}


interface NavBarProps extends NavBarConnectedProps {
  children?: string | React.ReactElement<{style?: React.CSSProperties}>
  dispatch: DispatchAllActions
  isLogoShown?: boolean
  isTransparent?: boolean
  onBackClick?: string | (() => void)
  page?: string
  style?: React.CSSProperties
}


interface NavBarState {
  isMenuShown?: boolean
  isModifyProjectModalShown?: boolean
}


class NavigationBarBase extends React.PureComponent<NavBarProps, NavBarState> {
  public static propTypes = {
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
    isLoggedIn: PropTypes.bool.isRequired,
    isLogoShown: PropTypes.bool,
    isOnboardingComplete: PropTypes.bool,
    isTransparent: PropTypes.bool,
    // A string is handled as a URL to route back to.
    onBackClick: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
    page: PropTypes.string,
    project: PropTypes.shape({
      projectId: PropTypes.string,
    }),
    style: PropTypes.object,
    userName: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isMenuShown: false,
    isModifyProjectModalShown: false,
  }

  public componentDidMount(): void {
    this.fixScroll()
  }

  public componentDidUpdate(): void {
    this.fixScroll()
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
    this.fixScroll(true)
  }

  private timeout: ReturnType<typeof setTimeout>

  private fixScroll(forceUnfix?: boolean): void {
    document.body.style.overflow = this.state.isMenuShown && !forceUnfix ? 'hidden' : 'initial'
  }

  private closeMenu = (): void => {
    const {isMenuShown} = this.state
    if (!isMenuShown) {
      return
    }
    this.timeout = setTimeout((): void => this.setState({isMenuShown: false}), 50)
  }

  private logOut = (): void => {
    this.props.dispatch(logoutAction)
  }

  private handleModifyProject = (): void => {
    this.closeMenu()
    this.setState({isModifyProjectModalShown: true})
  }

  private handleConnect = _memoize((visualElement: string): (() => void) =>
    (): void => {
      this.props.dispatch(openLoginModal({}, visualElement))
    })

  private handleConfirmModifyProject = (): void => {
    this.props.dispatch(modifyProject(this.props.project))
  }

  private handleShowModifyProjectModal =
  _memoize((isModifyProjectModalShown: boolean): (() => void) =>
    (): void => this.setState({isModifyProjectModalShown}))

  private handleToggleMenu = (): void => this.setState({isMenuShown: !this.state.isMenuShown})

  private renderBackChevron(): React.ReactNode {
    const {onBackClick} = this.props
    if (!onBackClick) {
      return null
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
    if (typeof onBackClick === 'string') {
      return <Link to={onBackClick}>
        <ChevronLeftIcon style={backIconStyle} />
      </Link>
    }
    return <ChevronLeftIcon style={backIconStyle} onClick={onBackClick} />
  }

  // TODO(marielaure): Make sure the navbar is switched to burger
  // even in onboarding when launching Strat2.
  private renderOnMobile(): React.ReactNode {
    const {children, featuresEnabled: {stratTwo},
      isLoggedIn, isLogoShown, onBackClick, project} = this.props
    const {isMenuShown, isModifyProjectModalShown} = this.state
    const hasStratTwo = stratTwo === 'ACTIVE'
    const style: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      color: isMenuShown ? 'inherit' : '#fff',
      display: 'flex',
      height: 50,
      justifyContent: 'center',
      position: 'relative',
    }
    const menuIconStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      fill: '#fff',
      height: 50,
      justifyContent: 'center',
      left: isLoggedIn && !hasStratTwo ? 'initial' : 0,
      opacity: isLoggedIn && !isMenuShown && !hasStratTwo ? 0.5 : 1,
      padding: 15,
      position: 'absolute',
      right: isLoggedIn && !hasStratTwo ? 0 : 'initial',
      top: 0,
      width: 50,
    }
    const menuStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      boxShadow: '0 10px 30px rgba(0, 0, 0, .5)',
      left: 0,
      paddingTop: 50,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 2,
    }
    const linkStyle = (page?: string): React.CSSProperties => ({
      color: 'inherit',
      ...page === this.props.page && {
        backgroundColor: colors.BOB_BLUE,
        color: '#fff',
      },
      display: 'block',
      padding: '20px 40px',
      textDecoration: 'none',
    })
    const backgroundStyle: React.CSSProperties = {
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
    const Icon = isLoggedIn && !hasStratTwo ? AccountCircleIcon : MenuIcon
    const isProjectModifiable = project && project.projectId && !project.isIncomplete
    return <React.Fragment>
      <nav style={style}>
        {isProjectModifiable ? <ModifyProjectModal
          isShown={isModifyProjectModalShown}
          onClose={this.handleShowModifyProjectModal(false)}
          onConfirm={this.handleConfirmModifyProject} /> : null}
        {this.renderBackChevron()}
        {isMenuShown ?
          <React.Fragment>
            <div style={backgroundStyle} />
            <OutsideClickHandler onOutsideClick={this.closeMenu}>
              <div style={menuStyle}>
                <CloseIcon
                  onClick={this.handleToggleMenu}
                  style={{...menuIconStyle, fill: colors.DARK_TWO}}
                />
                {isLoggedIn ? <React.Fragment>
                  {isProjectModifiable ? <a
                    style={linkStyle()}
                    onClick={this.handleModifyProject}>
                    Modifier mon projet
                  </a> : null}
                  <Link to={Routes.PROFILE_PAGE} style={linkStyle('profile')}>
                    Mes informations
                  </Link>
                  <a
                    style={linkStyle()}
                    onClick={openHelpDeskUrl}>
                    Nous contacter
                  </a>
                  <Link to={Routes.ROOT} style={linkStyle('logout')} onClick={this.logOut}>
                    Déconnexion
                  </Link>
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
                  <a
                    style={linkStyle('login')} onClick={this.handleConnect('menu')}>
                    Se connecter
                  </a>
                </React.Fragment>}
              </div>
            </OutsideClickHandler>
          </React.Fragment>
          // Don't show a menu if we can go back.
          : onBackClick ? null : <Icon
            name="menu" style={menuIconStyle} tabIndex={0}
            onClick={this.handleToggleMenu} />
        }
        {/* TODO(cyrille): Make sure text is centered vertically here. */}
        {children || (isLogoShown ? <Link to={Routes.ROOT}>
          <img src={logoProductWhiteImage} alt={config.productName} style={{height: 22}} />
        </Link> : null)}
      </nav>
    </React.Fragment>
  }

  private renderChildren(children: string | React.ReactElement<{style?: React.CSSProperties}>):
  React.ReactNode {
    if (!children || typeof children === 'string') {
      return <span style={{flex: 1, textAlign: 'center'}}>{children}</span>
    }
    return React.cloneElement(children, {
      style: {
        flex: 1,
        textAlign: 'center',
        ...children.props.style,
      },
    })
  }

  public render(): React.ReactNode {
    const {children, featuresEnabled, isLoggedIn, isLogoShown, isOnboardingComplete,
      isTransparent, page, project, style, userName, userYou} = this.props
    const {isMenuShown, isModifyProjectModalShown} = this.state
    if (isMobileVersion) {
      return this.renderOnMobile()
    }
    const containerStyle: React.CSSProperties = {
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
    }
    const logo = isLogoShown ?
      <img src={logoProductBetaImage} style={{height: 30}} alt={config.productName} /> : null
    if (!isLoggedIn) {
      const reducedContainerStyle: React.CSSProperties = {
        ...containerStyle,
        display: 'block',
        padding: `0 ${MIN_CONTENT_PADDING}px`,
      }
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
      return <nav style={reducedContainerStyle}>
        <div style={reducedNavBarStyle}>
          <div style={logoContainerStyle}>
            <Link to={Routes.ROOT}>{logo}</Link>
          </div>

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
            to={Routes.TRANSPARENCY_PAGE} isSelected={page === 'transparency'} selectionStyle="top"
            isOnTransparentBar={isTransparent}>
            Où en sommes-nous&nbsp;?
          </NavigationLink>

          <div style={connectContainerStyle}>
            <NavigationLink
              isOnTransparentBar={isTransparent}
              style={{padding: '20px 0 21px 25px'}}
              onClick={this.handleConnect('navbar')}>
              Se connecter
            </NavigationLink>
          </div>

        </div>
      </nav>
    }
    const isDuringOnboarding =
      (page === 'profile' || page === 'new_project') && !isOnboardingComplete
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
    const dropDownButtonStyle: RadiumCSSProperties = {
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
    }
    const isProjectModifiable = project && project.projectId && !project.isIncomplete
    const dropDownStyle: React.CSSProperties = {
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
    }
    const logoOnLeftStyle: React.CSSProperties = {
      // Have same outerWidth for menu and logo, so that children are centered.
      minWidth: menuStyle.minWidth,
      paddingLeft: 21,
    }
    const menuIconStyle: React.CSSProperties = {
      height: 25,
      marginTop: -1,
      paddingRight: 1,
      width: 26,
    }
    // TODO(cyrille): Unify behavior for menu between Mobile and Desktop.
    return <nav style={containerStyle}>
      {isProjectModifiable ? <ModifyProjectModal
        isShown={isModifyProjectModalShown}
        onClose={this.handleShowModifyProjectModal(false)}
        onConfirm={this.handleConfirmModifyProject} /> : null}
      {isDuringOnboarding ? <React.Fragment>
        <span style={{flex: `1 1 ${menuStyle.minWidth}px`}}></span>{logo}</React.Fragment> :
        <div style={logoOnLeftStyle}>
          <Link to={Routes.ROOT}>
            {logo}
          </Link>
        </div>}

      {this.renderChildren(children)}

      <Notifications
        page={page} notifications={featuresEnabled.poleEmploi ? [
          {
            href: 'https://projects.invisionapp.com/boards/SK39VCS276T8J/',
            subtitle: `Trouve${userYou('', 'z')} ici nos resources` +
              `pour présenter ${config.productName}`,
            title: `${userYou('Tu es', 'Vous êtes')} conseiller Pôle emploi ?`,
          },
        ] : []} />

      <OutsideClickHandler
        onOutsideClick={isMenuShown ? this.closeMenu : noOp} style={menuStyle}
        onClick={this.handleToggleMenu} tabIndex={0}>
        <div>
          <RadiumDiv style={dropDownButtonStyle}>
            {userName}&nbsp;<div style={{flex: 1}} /><UpDownIcon
              icon="menu"
              isUp={isMenuShown}
              style={menuIconStyle} />
          </RadiumDiv>
          <div style={dropDownStyle}>
            <MenuLink to={Routes.PROFILE_PAGE}>Mes informations</MenuLink>
            {isProjectModifiable ?
              <MenuLink onClick={this.handleShowModifyProjectModal(true)}>
                Modifier mon projet
              </MenuLink> : null}
            <MenuLink to={Routes.CONTRIBUTION_PAGE}>Contribuer</MenuLink>
            <MenuLink href="https://aide.bob-emploi.fr/hc/fr">Aide</MenuLink>
            <MenuLink href={config.helpRequestUrl}>Nous contacter</MenuLink>
            <MenuLink
              onClick={this.logOut} to={Routes.ROOT}
              style={{':hover': {color: '#fff'}, color: colors.COOL_GREY}}>
              Déconnexion
            </MenuLink>
          </div>
        </div>
      </OutsideClickHandler>
    </nav>
  }
}
const NavigationBar = connect(({user}: RootState): NavBarConnectedProps => ({
  featuresEnabled: user.featuresEnabled || {},
  isLoggedIn: !!(user.profile && user.profile.name),
  isOnboardingComplete: onboardingComplete(user),
  project: user.projects && user.projects[0],
  userName: user.profile && user.profile.name,
  userYou: youForUser(user),
}))(NavigationBarBase)


// Pseudo component that listens to location changes (from React Router) and
// updates the HTML title and meta description.
class TitleUpdaterBase extends React.PureComponent<RouteComponentProps<{}>> {
  public static propTypes = {
    location: ReactRouterPropTypes.location.isRequired,
  }

  public componentDidMount(): void {
    this.componentDidUpdate({location: {pathname: undefined}})
  }

  public componentDidUpdate({location: {pathname: previousPathname}}): void {
    const {location: {pathname}} = this.props
    if (previousPathname && previousPathname === pathname) {
      return
    }
    const {description, title} = getPageDescription(pathname.substr(1))

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
  }

  public render(): React.ReactNode {
    return null
  }
}
const TitleUpdater = withRouter(TitleUpdaterBase)


const ConnectedZendeskChatButton =
  connect(
    ({user: {profile}}: RootState): {user: bayes.bob.UserProfile} => ({user: profile})
  )(ZendeskChatButton)



export interface PageWithNavigationBarProps {
  isChatButtonShown?: boolean
  isContentScrollable?: boolean
  isCookieDisclaimerShown?: boolean
  isLogoShown?: boolean
  isNavBarTransparent?: boolean
  navBarContent?: string | JSX.Element
  onBackClick?: string | (() => void)
  onScroll?: () => void
  page?: string
  style?: React.CSSProperties
}


interface PageState {
  isDebugModalShown: boolean
}


class PageWithNavigationBar extends React.PureComponent<PageWithNavigationBarProps, PageState> {
  public static propTypes = {
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
    // A string is handled as a URL to route back to.
    onBackClick: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
    onScroll: PropTypes.func,
    page: PropTypes.string,
    style: PropTypes.object,
  }

  public static defaultProps = {
    isCookieDisclaimerShown: true,
    isLogoShown: true,
  }

  public state = {
    isDebugModalShown: false,
  }

  public componentDidMount(): void {
    const {isContentScrollable, onScroll} = this.props
    if (!isContentScrollable && onScroll) {
      window.addEventListener('scroll', onScroll)
    }
  }

  public componentWillUnmount(): void {
    const {isContentScrollable, onScroll} = this.props
    if (!isContentScrollable && onScroll) {
      window.removeEventListener('scroll', onScroll)
    }
  }

  public handleShowDebugModal = _memoize((isDebugModalShown: boolean): (() => void) =>
    (): void => this.setState({isDebugModalShown}))

  private scrollableDom: React.RefObject<HTMLDivElement> = React.createRef()

  public getScrollableDom = (): HTMLDivElement | HTMLBodyElement => this.props.isContentScrollable ?
    this.scrollableDom.current :
    window.document.body as HTMLBodyElement

  public scroll(options): void {
    const dom = this.getScrollableDom()
    if (dom) {
      dom.scroll(options)
    }
  }

  public scrollDelta(deltaOffsetTop: number): void {
    const dom = this.getScrollableDom()
    if (dom) {
      dom.scroll({
        behavior: 'smooth',
        top: dom.scrollTop + deltaOffsetTop,
      })
    }
  }

  public scrollTo(offsetTop: number): void {
    const dom = this.getScrollableDom()
    if (dom) {
      dom.scrollTop = offsetTop
    }
  }

  public render(): React.ReactNode {
    const {children, isChatButtonShown, isContentScrollable, isCookieDisclaimerShown, isLogoShown,
      isNavBarTransparent, navBarContent, onBackClick, onScroll, page, style,
      ...extraProps} = this.props
    let content
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }
    if (isContentScrollable) {
      containerStyle.height = '100vh'
      const scrollContainerStyle: React.CSSProperties = {
        WebkitOverflowScrolling: 'touch',
        bottom: 0,
        left: 0,
        overflow: 'auto',
        position: 'absolute',
        right: '0',
        top: '0',
        ...style,
      }
      content = <div style={{flex: 1, position: 'relative'}}>
        <div
          style={scrollContainerStyle} ref={this.scrollableDom} onScroll={onScroll} {...extraProps}>
          {children}
        </div>
      </div>
    } else {
      content = <div style={{flex: 1, ...style}} {...extraProps}>
        {children}
      </div>
    }
    return <div style={containerStyle}>
      <TitleUpdater />
      {isCookieDisclaimerShown ? <CookieMessage style={{flexShrink: 0}} /> : null}
      <BetaMessage style={{flexShrink: 0}} />
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <NavigationBar
          page={page} onBackClick={onBackClick} isTransparent={isNavBarTransparent}
          isLogoShown={isLogoShown} style={{flexShrink: 0}}>
          {navBarContent}
        </NavigationBar>
        <ConnectedZendeskChatButton
          isShown={isChatButtonShown && !isMobileVersion} language="fr"
          domain={config.zendeskDomain} />

        <ShortKey
          keyCode="KeyE" hasCtrlModifier={true} hasShiftModifier={true}
          onKeyUp={this.handleShowDebugModal(true)} />
        <DebugModal
          onClose={this.handleShowDebugModal(false)}
          isShown={this.state.isDebugModalShown} />

        {content}
      </div>
    </div>
  }
}
// NOTE: Do not wrap the above component (with Radium or React Router)
// otherwise scroll methods are not accessible anymore.


interface ModifyProjectModalProps extends Omit<ModalConfig, 'children'> {
  onConfirm: () => void
}


class ModifyProjectModal extends React.PureComponent<ModifyProjectModalProps> {
  public static propTypes = {
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {onClose, onConfirm, ...extraProps} = this.props
    const modalStyle: React.CSSProperties = {
      margin: isMobileVersion ? '0 20px' : 0,
      paddingBottom: isMobileVersion ? 30 : 40,
    }
    const noticeStyle: React.CSSProperties = {
      margin: isMobileVersion ? '35px 20px 40px' : '35px 50px 40px',
      maxWidth: 400,
    }
    const buttonsContainerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      justifyContent: 'center',
    }
    const topBottomStyle: React.CSSProperties = {
      marginBottom: isMobileVersion ? 10 : 0,
      marginRight: isMobileVersion ? 0 : 15,
    }
    return <Modal
      style={modalStyle} title="Modifier mes informations" onClose={onClose} {...extraProps}>
      <FastForward onForward={onConfirm} />
      <div style={noticeStyle}>
        En modifiant votre projet vous perdrez certains éléments de votre diagnostic actuel.
      </div>
      <div style={buttonsContainerStyle}>
        <Button type="back" onClick={onClose} isRound={true} style={topBottomStyle}>
          Annuler
        </Button>
        <Button onClick={onConfirm} isRound={true}>
          Continuer
        </Button>
      </div>
    </Modal>
  }
}


export {ModifyProjectModal, PageWithNavigationBar}
