import _forEach from 'lodash/forEach'
import AccountCircleIcon from 'mdi-react/AccountCircleIcon'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {withRouter} from 'react-router'
import {Link} from 'react-router-dom'
import {connect} from 'react-redux'

import {logoutAction, modifyProject, openLoginModal} from 'store/actions'
import {onboardingComplete} from 'store/main_selectors'

import bellImage from 'images/bell.svg'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'
import logoProductBetaImage from 'images/logo-bob-beta.svg'

import {DebugModal} from 'components/debug'
import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {ShortKey} from 'components/shortkey'
import {Modal} from 'components/modal'
import {PointsCounter} from 'components/points'
import {ZendeskChatButton} from 'components/zendesk'

import {getPageDescription} from '../../release/opengraph_redirect'

import {CookieMessage} from './cookie_message'
import {BetaMessage} from './beta_message'
import {Button, ExternalLink, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING,
  OutsideClickHandler, SmoothTransitions, Styles, UpDownIcon} from './theme'
import {Routes} from './url'

export const NAVIGATION_BAR_HEIGHT = 56


class Notifications extends React.Component {
  static propTypes= {
    notifications: PropTypes.arrayOf(PropTypes.shape({
      href: PropTypes.string,
      onClick: PropTypes.func,
      subtitle: PropTypes.string,
      title: PropTypes.node.isRequired,
    }).isRequired),
    page: PropTypes.string,
  }

  state = {
    isExpanded: false,
    isHovered: false,
  }

  render() {
    const {notifications, page} = this.props
    const {isExpanded, isHovered} = this.state
    // TODO(Marie Laure): Allows each page to send its notifications.
    if (!notifications || !notifications.length || page !== 'project') {
      return null
    }
    const notifHeight = 70
    const iconStyle = {
      cursor: 'pointer',
      opacity: (isExpanded || isHovered) ? 1 : .6,
      outline: 'none',
      padding: 15,
      width: 45,
      zIndex: 1,
      ...SmoothTransitions,
    }
    const containerStyle = {
      maxHeight: isExpanded ? ((notifHeight + 1) * notifications.length) : 0,
      opacity: isExpanded ? 1 : 0,
      overflow: 'hidden',
      position: 'absolute',
      right: 150,
      top: '100%',
      width: 380,
      ...SmoothTransitions,
    }
    const notificationStyle = index => ({
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
    const triangleContainerStyle = {
      bottom: 0,
      lineHeight: '6px',
      opacity: isExpanded ? 1 : 0,
      position: 'absolute',
      textAlign: 'center',
      width: iconStyle.width,
      ...SmoothTransitions,
    }
    const triangleStyle = {
      borderBottom: 'solid 6px #fff',
      borderLeft: 'solid 6px transparent',
      borderRight: 'solid 6px transparent',
      display: 'inline-block',
    }
    const chevronIconStyle = {
      fill: colors.CHARCOAL_GREY,
      height: 31,
      marginRight: 20,
      width: 25,
    }
    return <div
      onBlur={() => this.setState({isExpanded: false})}
      onMouseEnter={() => this.setState({isHovered: true})}
      onMouseLeave={() => this.setState({isHovered: false})}
      style={{alignItems: 'center', display: 'flex', width: iconStyle.width}}>
      <img
        src={bellImage} style={iconStyle} tabIndex={0}
        onClick={() => this.setState({isExpanded: true})}
        alt="notifications" />

      <div style={triangleContainerStyle}>
        <div style={triangleStyle} />
      </div>

      <div style={containerStyle}>
        {notifications.map((notification, index) => <div
          key={`notif-${index}`} style={notificationStyle(index)}
          onClick={notification.onClick || (() => window.open(notification.href, '_blank'))}>
          <div style={Styles.CENTER_FONT_VERTICALLY}>
            <strong>{notification.title}</strong>
            {notification.subtitle ? <div>{notification.subtitle}</div> : null}
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


class NavigationLink extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isOnTransparentBar: PropTypes.bool,
    isSelected: PropTypes.bool,
    selectionStyle: PropTypes.oneOf(['bottom', 'top']),
    style: PropTypes.object,
    to: PropTypes.string,
  }

  state = {
    isFocused: false,
    isHovered: false,
  }

  render() {
    const {children, isOnTransparentBar, isSelected, selectionStyle, style, to,
      ...extraProps} = this.props
    const {isFocused, isHovered} = this.state
    const isHighlighted = isSelected || isHovered || isFocused
    const isSelectionOnTop = selectionStyle === 'top'
    const containerStyle = {
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
    const selectMarkStyle = {
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
      onBlur: () => this.setState({isFocused: false}),
      onFocus: () => this.setState({isFocused: true}),
      onMouseEnter: () => this.setState({isHovered: true}),
      onMouseLeave: () => this.setState({isHovered: false}),
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


const RadiumLink = Radium(Link)
const RadiumExternalLink = Radium(ExternalLink)


class MenuLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
    to: PropTypes.string,
  }

  render() {
    const {children, style, to, ...extraProps} = this.props
    const containerStyle = {
      alignItems: 'center',
      color: colors.DARK_TWO,
      display: 'flex',
      fontWeight: 'normal',
      height: MENU_LINK_HEIGHT,
      paddingLeft: 25,
      textAlign: 'left',
      textDecoration: 'none',
      ...style,
      // eslint-disable-next-line sort-keys
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
const MenuLink = Radium(MenuLinkBase)


class NavigationBarBase extends React.Component {
  static propTypes = {
    areBobPointsEnabled: PropTypes.bool,
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
    isOnboardingComplete: PropTypes.bool,
    isTransparent: PropTypes.bool,
    // A string is handled as a URL to route back to.
    onBackClick: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
    page: PropTypes.string,
    points: PropTypes.number,
    project: PropTypes.shape({
      projectId: PropTypes.string,
    }),
    style: PropTypes.object,
    userProfile: PropTypes.shape({
      name: PropTypes.string,
    }).isRequired,
  }

  state = {
    isMenuShown: false,
    isModifyProjectModalShown: false,
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  closeMenu = () => {
    if (!this.state.isMenuShown) {
      return
    }
    this.timeout = setTimeout(() => this.setState({isMenuShown: false}), 50)
  }

  logOut = () => {
    this.props.dispatch(logoutAction)
  }

  toggleMenuShown = () => {
    this.setState({isMenuShown: !this.state.isMenuShown})
  }

  renderBackChevron() {
    const {areBobPointsEnabled, onBackClick} = this.props
    if (!onBackClick) {
      return null
    }
    const backIconStyle = {
      alignItems: 'center',
      display: 'flex',
      fill: '#fff',
      height: 50,
      justifyContent: 'center',
      left: areBobPointsEnabled ? 30 : 0,
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

  renderOnMobile() {
    const {children, dispatch, areBobPointsEnabled, isLoggedIn, page, points,
      project} = this.props
    const {isMenuShown, isModifyProjectModalShown} = this.state
    const style = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      color: '#fff',
      display: 'flex',
      height: 50,
      justifyContent: 'center',
      position: 'relative',
    }
    const menuIconStyle = {
      alignItems: 'center',
      display: 'flex',
      fill: '#fff',
      height: 50,
      justifyContent: 'center',
      left: isLoggedIn && !areBobPointsEnabled ? 'initial' : 0,
      opacity: isLoggedIn && !isMenuShown ? 0.5 : 1,
      padding: isLoggedIn ? 10 : 15,
      position: 'absolute',
      right: isLoggedIn && !areBobPointsEnabled ? 0 : 'initial',
      top: 0,
      width: 50,
    }
    const menuStyle = {
      backgroundColor: colors.CHARCOAL_GREY,
      color: '#fff',
      left: 0,
      paddingTop: 50,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 2,
    }
    const pointStyle = {
      color: 'inherit',
      position: 'absolute',
      right: 10,
      textDecoration: 'none',
    }
    const linkStyle = page => ({
      backgroundColor: page === this.props.page ? colors.RED_PINK : 'inherit',
      color: '#fff',
      display: 'block',
      padding: '20px 40px',
      textDecoration: 'none',
      textTransform: 'uppercase',
    })
    const Icon = isLoggedIn ? AccountCircleIcon : MenuIcon
    const isProjectModifiable = project && project.projectId && !project.isIncomplete
    return <React.Fragment>
      <nav style={style}>
        {isProjectModifiable ? <ModifyProjectModal
          isShown={isModifyProjectModalShown}
          onClose={() => this.setState({isModifyProjectModalShown: false})}
          onConfirm={() => dispatch(modifyProject(project))} /> : null}
        {this.renderBackChevron()}
        {isMenuShown ?
          <OutsideClickHandler onOutsideClick={this.closeMenu}>
            <div style={menuStyle}>
              <CloseIcon
                onClick={() => this.setState({isMenuShown: false})}
                style={menuIconStyle}
              />
              {isLoggedIn ? <React.Fragment>
                {isProjectModifiable ? <a
                  style={linkStyle()}
                  onClick={() => {
                    this.closeMenu()
                    this.setState({isModifyProjectModalShown: true})
                  }}>
                  Modifer votre projet
                </a> : null}
                <Link to={Routes.PROFILE_PAGE} style={linkStyle('profile')}>
                  Vos informations
                </Link>
                <a style={linkStyle()} onClick={() => window.open(config.helpRequestUrl, '_blank')}>
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
                  style={linkStyle('login')} onClick={() => dispatch(openLoginModal({}, 'menu'))}>
                  Se connecter
                </a>
              </React.Fragment>}
            </div>
          </OutsideClickHandler>
          : <Icon
            name="menu" style={menuIconStyle} tabIndex={0}
            onClick={() => this.setState({isMenuShown: true})} />
        }
        {areBobPointsEnabled && isLoggedIn && page !== 'points' ? <Link
          to={Routes.POINTS_PAGE} style={pointStyle}>
          <PointsCounter count={points} />
        </Link> : null}
        {/* TODO(cyrille): Make sure text is centered vertically here. */}
        {children || <Link to={Routes.ROOT}>
          <img src={logoProductWhiteImage} alt={config.productName} style={{height: 22}} />
        </Link>}
      </nav>
    </React.Fragment>
  }

  // TODO(cyrille): Add points counter.
  render() {
    const {dispatch, children, featuresEnabled, isLoggedIn, isOnboardingComplete, isTransparent,
      page, project, style, userProfile} = this.props
    const {name} = userProfile
    const {isMenuShown, isModifyProjectModalShown} = this.state
    if (isMobileVersion) {
      return this.renderOnMobile()
    }
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: isTransparent ? 'initial' : colors.BOB_BLUE,
      color: '#fff',
      display: 'flex',
      fontFamily: 'Lato, Helvetica',
      height: NAVIGATION_BAR_HEIGHT,
      justifyContent: 'flex-end',
      position: isTransparent ? 'absolute' : 'relative',
      width: '100%',
      zIndex: isTransparent ? 2 : 'initial',
      ...style,
    }
    const logo = <img src={logoProductBetaImage} style={{height: 30}} alt={config.productName} />
    if (!isLoggedIn) {
      const reducedContainerStyle = {
        ...containerStyle,
        display: 'block',
        padding: `0 ${MIN_CONTENT_PADDING}px`,
      }
      const reducedNavBarStyle = {
        alignItems: 'center',
        display: 'flex',
        height: NAVIGATION_BAR_HEIGHT,
        justifyContent: 'center',
        margin: 'auto',
        maxWidth: MAX_CONTENT_WIDTH,
        position: 'relative',
      }
      const logoContainerStyle = {
        alignItems: 'center',
        bottom: 0,
        display: 'flex',
        left: 0,
        position: 'absolute',
        top: 0,
      }
      const connectContainerStyle = {
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
            Qui est Bob&nbsp;?
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
              onClick={() => dispatch(openLoginModal({}, 'navbar'))}>
              Se connecter
            </NavigationLink>
          </div>

        </div>
      </nav>
    }
    const isDuringOnboarding =
      (page === 'profile' || page === 'new_project') && !isOnboardingComplete
    const linkContainerStyle = {
      alignSelf: 'stretch',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: 1,
      padding: '7px 40px',
      textAlign: 'center',
      textDecoration: 'none',
    }
    const menuStyle = {
      ...linkContainerStyle,
      cursor: 'pointer',
      minWidth: 180,
      outline: 'none',
      position: 'relative',
    }
    const dropDownButtonStyle = {
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
    const dropDownStyle = {
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
    const logoOnLeftStyle = {
      // Have same outerWidth for menu and logo, so that children are centered.
      minWidth: menuStyle.minWidth,
      paddingLeft: 21,
    }
    const menuIconStyle = {
      fill: dropDownButtonStyle.color,
      height: 25,
      marginTop: -1,
      paddingRight: 1,
      width: 26,
    }
    // TODO(cyrille): Unify behavior for menu between Mobile and Desktop.
    return <nav style={containerStyle}>
      {isProjectModifiable ? <ModifyProjectModal
        isShown={isModifyProjectModalShown}
        onClose={() => this.setState({isModifyProjectModalShown: false})}
        onConfirm={() => dispatch(modifyProject(project))} /> : null}
      {/* TODO(marielaure): Make it possible to put the logo in the middle for the onboarding. */}
      <div style={logoOnLeftStyle}>
        {isDuringOnboarding ? logo : <Link to={Routes.ROOT}>
          {logo}
        </Link>}
      </div>

      {children && children.props ? React.cloneElement(children, {
        style: {
          flex: 1,
          textAlign: 'center',
          ...children.props.style,
        },
      }) : <span style={{flex: 1, textAlign: 'center'}}>{children}</span>}

      <Notifications
        page={page} notifications={featuresEnabled.poleEmploi ? [
          {
            href: 'https://projects.invisionapp.com/boards/SK39VCS276T8J/',
            subtitle: `Trouvez ici nos resources pour présenter ${config.productName}`,
            title: 'Vous êtes conseiller Pôle emploi ?',
          },
        ] : []} />

      <OutsideClickHandler
        onOutsideClick={isMenuShown ? this.closeMenu : () => {}} style={menuStyle}
        onClick={this.toggleMenuShown} tabIndex="0">
        <div>
          <div style={dropDownButtonStyle}>
            {name}&nbsp;<div style={{flex: 1}} /><UpDownIcon
              icon="menu"
              isUp={isMenuShown}
              style={menuIconStyle} />
          </div>
          <div style={dropDownStyle}>
            <MenuLink to={Routes.PROFILE_PAGE}>Vos informations</MenuLink>
            {isProjectModifiable ?
              <MenuLink onClick={() => this.setState({isModifyProjectModalShown: true})}>
                Modifer votre projet
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
const NavigationBar = connect(({user}) => ({
  areBobPointsEnabled: user.featuresEnabled && user.featuresEnabled.bobPoints === 'ACTIVE',
  featuresEnabled: user.featuresEnabled || {},
  isLoggedIn: !!(user.profile && user.profile.name),
  isOnboardingComplete: onboardingComplete(user),
  points: user.appPoints && user.appPoints.current || 0,
  project: user.projects && user.projects[0],
  userProfile: user.profile,
}))(Radium(NavigationBarBase))


// Pseudo component that listens to location changes (from React Router) and
// updates the HTML title and meta description.
class TitleUpdaterBase extends React.Component {
  static propTypes = {
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }).isRequired,
  }

  componentDidMount() {
    this.componentDidUpdate({location: {}})
  }

  componentDidUpdate({location: {pathname: previousPathname}}) {
    const {location: {pathname}} = this.props
    if (previousPathname && previousPathname === pathname) {
      return
    }
    const {description, title} = getPageDescription(pathname.substr(1))

    // Update the title.
    _forEach(document.getElementsByTagName('title'), titleElement => {
      titleElement.innerText = title
    })

    // Update the description.
    _forEach(document.getElementsByTagName('meta'), metaElement => {
      if (metaElement.getAttribute('name') === 'description') {
        metaElement.setAttribute('content', description || '')
      }
    })
  }

  render() {
    return null
  }
}
const TitleUpdater = withRouter(TitleUpdaterBase)


const ConnectedZendeskChatButton =
  connect(({user: {profile}}) => ({user: profile}))(ZendeskChatButton)


class PageWithNavigationBar extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isChatButtonShown: PropTypes.bool,
    isContentScrollable: PropTypes.bool,
    isCookieDisclaimerShown: PropTypes.bool,
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

  static defaultProps = {
    isCookieDisclaimerShown: true,
  }

  state = {
    isDebugModalShown: false,
  }

  componentDidMount() {
    const {isContentScrollable, onScroll} = this.props
    if (!isContentScrollable && onScroll) {
      window.addEventListener('scroll', onScroll)
    }
  }

  componentWillUnmount() {
    const {isContentScrollable, onScroll} = this.props
    if (!isContentScrollable && onScroll) {
      window.removeEventListener('scroll', onScroll)
    }
  }

  scroll(options) {
    const dom = this.props.isContentScrollable ? this.scrollableDom : window.document.body
    if (dom) {
      dom.scroll(options)
    }
  }

  scrollDelta(deltaOffsetTop) {
    const dom = this.props.isContentScrollable ? this.scrollableDom : window.document.body
    if (dom) {
      dom.scroll({
        behavior: 'smooth',
        top: dom.scrollTop + deltaOffsetTop,
      })
    }
  }

  scrollTo(offsetTop) {
    if (this.props.isContentScrollable) {
      if (this.scrollableDom) {
        this.scrollableDom.scrollTop = offsetTop
      }
    } else {
      window.document.body.scrollTop = offsetTop
    }
  }

  render() {
    const {children, isChatButtonShown, isContentScrollable, isCookieDisclaimerShown,
      isNavBarTransparent, navBarContent, onBackClick, onScroll, page, style,
      ...extraProps} = this.props
    let content
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }
    if (isContentScrollable) {
      containerStyle.height = '100vh'
      const scrollContainerStyle = {
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
          style={scrollContainerStyle} ref={dom => {
            this.scrollableDom = dom
          }} onScroll={onScroll} {...extraProps}>
          {children}
        </div>
      </div>
    } else {
      content = <div style={{flex: 1, ...style}} {...extraProps}>
        {children}
      </div>
    }
    // TODO(marielaure): Propagate font family to children that still needs GTWalsheim.
    return <div style={containerStyle}>
      <TitleUpdater />
      {isCookieDisclaimerShown ? <CookieMessage style={{flexShrink: 0}} /> : null}
      <BetaMessage style={{flexShrink: 0}} />
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <NavigationBar
          page={page} onBackClick={onBackClick}
          isTransparent={isNavBarTransparent} style={{flexShrink: 0, fontFamily: 'GTWalsheim'}}>
          {navBarContent}
        </NavigationBar>
        <ConnectedZendeskChatButton
          isShown={isChatButtonShown && !isMobileVersion} language="fr"
          domain={config.zendeskDomain} />

        <ShortKey
          keyCode="KeyE" hasCtrlModifier={true} hasShiftModifier={true}
          onKeyUp={() => this.setState({isDebugModalShown: true})} />
        <DebugModal
          onClose={() => this.setState({isDebugModalShown: false})}
          isShown={this.state.isDebugModalShown} />

        {content}
      </div>
    </div>
  }
}
// NOTE: Do not wrap the above component (with Radium or React Router)
// otherwise scroll methods are not accessible anymore.


class ModifyProjectModal extends React.Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
  }

  render() {
    const {onClose, onConfirm, ...extraProps} = this.props
    const modalStyle = {
      borderRadius: isMobileVersion ? 10 : 0,
      margin: isMobileVersion ? '0 20px' : 0,
      padding: isMobileVersion ? '0 20px 30px' : '0 50px 40px',
      textAlign: 'center',
    }
    const noticeStyle = {
      fontSize: 15,
      fontStyle: 'italic',
      lineHeight: 1.33,
      margin: '35px 0 40px',
      maxWidth: 400,
    }
    return <Modal
      style={modalStyle} title="Modifier mes informations" onClose={onClose} {...extraProps}>
      <FastForward onForward={onConfirm} />
      <div style={noticeStyle}>
        En modifiant votre projet vous perdrez certains éléments de votre diagnostic actuel.
      </div>
      <Button type="back" style={{marginRight: 25}} onClick={onClose} isRound={true}>
        Annuler
      </Button>
      <Button onClick={onConfirm} isRound={true}>
        Continuer
      </Button>
    </Modal>
  }
}


export {ModifyProjectModal, NavigationBar, PageWithNavigationBar}
