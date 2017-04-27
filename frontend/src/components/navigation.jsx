import React from 'react'
import {Link, browserHistory} from 'react-router'
import {connect} from 'react-redux'
import Radium from 'radium'

import config from 'config'
import {logoutAction} from 'store/actions'
import {USER_PROFILE_SHAPE} from 'store/user_reducer'
import {onboardingComplete} from 'store/main_selectors'

import {DebugModal} from 'components/debug'
import {ShortKey} from 'components/shortkey'
import {CookieMessage} from './cookie_message'
import {BetaMessage} from './beta_message'
import {Colors, Icon, SmoothTransitions, Styles} from './theme'
import {Routes} from './url'
import {LoginButton} from 'components/login'


const navLinkStyle = {
  color: Colors.COOL_GREY,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: 1,
  padding: '20px 25px 21px',
  textTransform: 'uppercase',
}


class NavigationLink extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    isSelected: React.PropTypes.bool,
    selectionStyle: React.PropTypes.oneOf(['bottom', 'top']),
    style: React.PropTypes.object,
    to: React.PropTypes.string,
  }

  state = {
    isFocused: false,
    isHovered: false,
  }

  render() {
    const {children, isSelected, selectionStyle, style, ...extraProps} = this.props
    const isHighlighted = isSelected || this.state.isHovered || this.state.isFocused
    const isSelectionOnTop = selectionStyle === 'top'
    const containerStyle = {
      ...navLinkStyle,
      color: isHighlighted ? '#fff' : navLinkStyle.color,
      position: 'relative',
      textDecoration: 'none',
      ...SmoothTransitions,
      ...style,
      ...(isHighlighted && style && style[':highlight'] || null),
    }
    const selectMarkStyle = {
      backgroundColor: Colors.RED_PINK,
      borderRadius: isSelectionOnTop ? '0 0 3px 3px' : '3px 3px 0 0',
      bottom: isSelectionOnTop ? 'initial' : 0,
      height: 4,
      left: '35%',
      position: 'absolute',
      top: isSelectionOnTop ? 0 : 'initial',
      width: '30%',
    }
    return <Link
        {...extraProps} style={containerStyle}
        onMouseOut={() => this.setState({isHovered: false})}
        onMouseOver={() => this.setState({isHovered: true})}
        onFocus={() => this.setState({isFocused: true})}
        onBlur={() => this.setState({isFocused: false})}>
      {children}
      {(isSelected && selectionStyle) ? <div style={selectMarkStyle} /> : null}
    </Link>
  }
}


const MENU_LINK_HEIGHT = 50


class MenuLinkBase extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    style: React.PropTypes.object,
  }

  render() {
    const {children, style, ...extraProps} = this.props
    const containerStyle = {
      alignItems: 'center',
      color: '#fff',
      display: 'flex',
      fontWeight: 'normal',
      height: MENU_LINK_HEIGHT,
      paddingLeft: 25,
      textAlign: 'left',
      ...style,
      // eslint-disable-next-line sort-keys
      ':focus': {
        backgroundColor: Colors.RED_PINK,
        ...(style && style[':hover'] || {}),
      },
      ':hover': {
        backgroundColor: Colors.RED_PINK,
        ...(style && style[':hover'] || {}),
      },
    }
    return <div {...extraProps} style={containerStyle}>
      {children}
    </div>
  }
}
const MenuLink = Radium(MenuLinkBase)


class MobileNavigationBarBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isLoggedIn: React.PropTypes.bool.isRequired,
    onNavigateBack: React.PropTypes.func,
    onboardingComplete: React.PropTypes.bool,
    page: React.PropTypes.string,
  }

  state = {
    isMenuOpen: false,
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.isMenuOpen && this.state.isMenuOpen) {
      this.refs.close.focus()
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  closeMenu = () => {
    this.timeout = setTimeout(() => this.setState({isMenuOpen: false}), 50)
  }

  logOut = event => {
    event.stopPropagation()
    this.props.dispatch(logoutAction)
    browserHistory.push(Routes.ROOT)
  }

  render() {
    const {onNavigateBack, onboardingComplete, isLoggedIn} = this.props
    const {isMenuOpen} = this.state
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.DARK,
      color: '#fff',
      display: 'flex',
      height: 50,
      justifyContent: 'center',
      position: 'relative',
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const menuIconStyle = {
      alignItems: 'center',
      display: 'flex',
      fontSize: 20,
      height: 50,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      top: 0,
      width: 50,
    }
    const menuStyle = {
      backgroundColor: Colors.CHARCOAL_GREY,
      color: '#fff',
      left: 0,
      paddingTop: 50,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
    }
    const linkStyle = page => ({
      backgroundColor: page === this.props.page ? Colors.RED_PINK : 'inherit',
      color: '#fff',
      display: 'block',
      padding: '20px 40px',
      textDecoration: 'none',
      textTransform: 'uppercase',
    })
    return <nav style={style}>
      {isMenuOpen ?
        <div style={menuStyle} onBlur={this.closeMenu}>
          <Icon
              name="close" style={menuIconStyle} tabIndex={0} ref="close"
              onClick={() => this.setState({isMenuOpen: false})} />
          <Link to={Routes.ROOT} style={linkStyle('landing')}>
            Accueil
          </Link>
          <Link to={Routes.VISION_PAGE} style={linkStyle('vision')}>
            Notre mission
          </Link>
          <Link to={Routes.CONTRIBUTION_PAGE} style={linkStyle('contribution')}>
            Contribuer
          </Link>
          {isLoggedIn && onboardingComplete ? <div>
            <Link to={Routes.PROJECT_PAGE} style={linkStyle('project')}>
              Mon projet
            </Link>
          </div> : null}
          {isLoggedIn ? <div>
            <Link to={Routes.PROFILE_PAGE} style={linkStyle('profile')}>
              Vos informations
            </Link>
            <Link style={linkStyle('logout')} onClick={this.logOut}>
              Déconnexion
            </Link>
          </div> : null}
        </div>
      : onNavigateBack ?
        <Icon
            name="chevron-left" style={{...menuIconStyle, fontSize: 30}}
            onClick={onNavigateBack} />
        : <Icon
            name="menu" style={menuIconStyle} tabIndex={0}
            onClick={() => this.setState({isMenuOpen: true})} />
      }
      <img src={require('images/logo-bob-mobile.svg')} alt={config.productName} />
    </nav>
  }
}
const MobileNavigationBar = connect(({user}) => ({
  isLoggedIn: !!(user.profile && user.profile.name),
  onboardingComplete: onboardingComplete(user),
}))(MobileNavigationBarBase)



class NavigationBarBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    onboardingComplete: React.PropTypes.bool,
    page: React.PropTypes.string,
    style: React.PropTypes.object,
    userProfile: USER_PROFILE_SHAPE.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool.isRequired,
  }

  state = {
    isLogOutDropDownShown: false,
  }

  logOut = event => {
    event.stopPropagation()
    this.props.dispatch(logoutAction)
    browserHistory.push(Routes.ROOT)
  }

  toggleMenuDropDown = () => {
    this.setState({isLogOutDropDownShown: !this.state.isLogOutDropDownShown})
  }

  collapseDropDown = () => {
    this.setState({isLogOutDropDownShown: false})
  }

  handleLogoClick = () => {
    const {page, onboardingComplete} = this.props
    if ((page === 'profile' || page === 'new_project') && !onboardingComplete) {
      return
    }
    browserHistory.push(Routes.ROOT)
  }

  render() {
    const {onboardingComplete, page, style, userProfile} = this.props
    const {isMobileVersion} = this.context
    const {name} = userProfile
    const {isLogOutDropDownShown} = this.state
    if (isMobileVersion) {
      return <MobileNavigationBar {...this.props} />
    }
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: Colors.DARK,
      color: '#fff',
      display: 'flex',
      height: 56,
      position: 'relative',
      ...style,
    }
    const linkContainerStyle = {
      alignSelf: 'stretch',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: 1,
      padding: '7px 40px',
      textAlign: 'center',
      textDecoration: 'none',
    }
    const logo = <img
        src={require('images/logo-bob-emploi-beta.svg')}
        style={{cursor: 'pointer', marginLeft: 27}}
        onClick={this.handleLogoClick} />
    if (!name) {
      const loginButtonStyle = {
        ...navLinkStyle,
        ':hover': {
          backgroundColor: 'initial',
          color: '#fff',
        },
      }
      return <nav style={containerStyle}>
        {logo}

        <div style={{flex: 1}} />

        <NavigationLink to={Routes.ROOT} isSelected={page === 'landing'} selectionStyle="top">
          Accueil
        </NavigationLink>
        <NavigationLink to={Routes.VISION_PAGE} isSelected={page === 'vision'} selectionStyle="top">
          Notre mission
        </NavigationLink>
        <NavigationLink
            to={Routes.CONTRIBUTION_PAGE} isSelected={page === 'contribution'} selectionStyle="top">
          Contribuer
        </NavigationLink>
        <LoginButton style={loginButtonStyle} visualElement="navbar" type="discreet">
          Se connecter
        </LoginButton>
      </nav>
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
        backgroundColor: Colors.CHARCOAL_GREY,
        color: '#fff',
      },
      ':hover': {
        backgroundColor: Colors.CHARCOAL_GREY,
        color: '#fff',
      },
      alignItems: 'center',
      backgroundColor: isLogOutDropDownShown ? Colors.CHARCOAL_GREY : 'initial',
      borderLeft: `solid 1px ${Colors.SLATE}`,
      bottom: 0,
      color: Colors.COOL_GREY,
      display: 'flex',
      justifyContent: 'center',
      left: 0,
      padding: 25,
      position: 'absolute',
      right: 0,
      top: 0,
      ...SmoothTransitions,
    }
    const openInNewTab = href => window.open(href, '_blank')
    const menuItems = [
      <MenuLink key="profile" onClick={() => browserHistory.push(Routes.PROFILE_PAGE)}>
        Vos informations
      </MenuLink>,
      <MenuLink key="terms" onClick={() => browserHistory.push(Routes.TERMS_AND_CONDITIONS_PAGE)}>
        Conditions générales
      </MenuLink>,
      <MenuLink key="vision" onClick={() => browserHistory.push(Routes.VISION_PAGE)}>
        Notre mission
      </MenuLink>,
      <MenuLink key="contribute" onClick={() => browserHistory.push(Routes.CONTRIBUTION_PAGE)}>
        Contribuer
      </MenuLink>,
      <MenuLink key="contact" onClick={() => {
        openInNewTab(config.helpRequestUrl)
      }}>
        Nous contacter
      </MenuLink>,
      <MenuLink key="logout"
          onClick={this.logOut}
          style={{':hover': {color: '#fff'}, color: Colors.COOL_GREY}}>
        Déconnexion
      </MenuLink>,
    ]
    const dropDownStyle = {
      ...linkContainerStyle,
      alignItems: 'center',
      backgroundColor: dropDownButtonStyle.backgroundColor,
      borderTop: isLogOutDropDownShown ? 'solid 1px rgba(255, 255, 255, .2)' : 'none',
      height: isLogOutDropDownShown ? menuItems.length * MENU_LINK_HEIGHT : 0,
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
    return <nav style={containerStyle}>
      {logo}

      <div style={{flex: 1}} />

      {onboardingComplete ? <div>
        <NavigationLink
            to={Routes.PROJECT_PAGE} isSelected={page === 'project'} selectionStyle="bottom">
          Mon projet
        </NavigationLink>
        <NavigationLink
            to="https://aide.bob-emploi.fr/hc/fr" target="_blank"
            style={{padding: '20px 50px 21px 25px'}} selectionStyle="bottom">
          Aide
        </NavigationLink>
      </div> : null}

      <div
          style={menuStyle} onClick={this.toggleMenuDropDown}
          onBlur={this.collapseDropDown} tabIndex="0">
        <div style={dropDownButtonStyle} ref="menu">
          {name}&nbsp;<div style={{flex: 1}} /><Icon
            name={'menu-' + (isLogOutDropDownShown ? 'up' : 'down')}
            style={{fontSize: 25, lineHeight: '13px', verticalAlign: 'middle'}} />
        </div>
        <div style={dropDownStyle}>
          {menuItems}
        </div>
      </div>
    </nav>
  }
}
const NavigationBar = connect(({user}) => ({
  onboardingComplete: onboardingComplete(user),
  userProfile: user.profile,
}))(Radium(NavigationBarBase))


class Footer extends React.Component {
  static propTypes = {
    page: React.PropTypes.string,
    style: React.PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool.isRequired,
  }

  render() {
    const {page, style} = this.props
    const {isMobileVersion} = this.context
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: Colors.DARK,
      display: 'flex',
      height: isMobileVersion ? 'initial' : 135,
      padding: isMobileVersion ? '35px 0' : '0 50px',
      ...style,
    }
    if (isMobileVersion) {
      containerStyle.flexDirection = 'column'
    }
    const logoStyle = {
      height: 65,
      marginBottom: isMobileVersion ? 35 : 0,
      // Trick to center the logo without the Beta.
      marginLeft: isMobileVersion ? 40 : 0,
    }
    const linkStyle = {
      fontSize: 11,
      letterSpacing: 1.5,
      padding: isMobileVersion ? 12 : 30,
    }
    const iconStyle = {
      ...linkStyle,
      ':highlight': {opacity: 1},
      opacity: .5,
      padding: 8,
    }
    return <footer style={containerStyle}>
      <img
          src={isMobileVersion ?
            require('images/logo-bob-emploi-beta-mobile.svg') :
            require('images/logo-bob-emploi-white.svg')}
          style={logoStyle} />

      <div style={{flex: 1}} />

      <NavigationLink
          style={linkStyle} to={Routes.TERMS_AND_CONDITIONS_PAGE}
          isSelected={page === 'terms'}>
        Conditions générales
      </NavigationLink>

      <NavigationLink
          style={linkStyle} to={Routes.PRIVACY_PAGE}
          isSelected={page === 'privacy'}>
        Vie privée
      </NavigationLink>

      <NavigationLink style={linkStyle} target="_blank" to={config.helpRequestUrl}>
        Nous contacter
      </NavigationLink>

      <div style={{flex: 1}} />

      <NavigationLink style={iconStyle} to="https://www.facebook.com/bobemploi" target="_blank">
        <img src={require('images/facebook.svg')} alt="Facebook" />
      </NavigationLink>

      <NavigationLink style={iconStyle} to="https://twitter.com/bobemploi" target="_blank">
        <img src={require('images/twitter.svg')} alt="Twitter" />
      </NavigationLink>
    </footer>
  }
}


class PageWithNavigationBar extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    isContentScrollable: React.PropTypes.bool,
    onNavigateBack: React.PropTypes.func,
    page: React.PropTypes.string,
    style: React.PropTypes.object,
  }

  state = {
    isDebugModalShown: false,
  }

  scrollTo(offsetTop) {
    const {scrollable} = this.refs
    if (scrollable) {
      scrollable.scrollTop = offsetTop
    }
  }

  render() {
    const {children, isContentScrollable, onNavigateBack, page, style, ...extraProps} = this.props
    let content
    if (isContentScrollable) {
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
        <div style={scrollContainerStyle} ref="scrollable" {...extraProps}>
          {children}
        </div>
      </div>
    } else {
      content = <div style={{flex: 1, ...style}} {...extraProps}>
        {children}
      </div>
    }
    return <div style={{display: 'flex', flexDirection: 'column', height: '100vh'}}>
      <CookieMessage />
      <BetaMessage />
      <NavigationBar onNavigateBack={onNavigateBack} page={page} />

      <ShortKey
          keyCode="KeyE" ctrlKey={true} shiftKey={true}
          onKeyPress={() => this.setState({isDebugModalShown: true})} />
      <DebugModal
          onClose={() => this.setState({isDebugModalShown: false})}
          isShown={this.state.isDebugModalShown} />

      {content}
    </div>
  }
}


export {Footer, NavigationBar, PageWithNavigationBar}
