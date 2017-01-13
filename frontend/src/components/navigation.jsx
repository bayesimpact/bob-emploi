import React from 'react'
import {Link, browserHistory} from 'react-router'
import {connect} from 'react-redux'
import Radium from 'radium'

import config from 'config'
import {logoutAction} from 'store/actions'
import {USER_PROFILE_SHAPE} from 'store/user_reducer'
import {onboardingComplete} from 'store/main_selectors'

import {NewProjectModal} from 'components/new_project'
import {CookieMessage} from './cookie_message'
import {BetaMessage} from './beta_message'
import {Colors, Icon, SmoothTransitions, Styles} from './theme'
import {Routes} from './url'
import {LoginButton} from 'components/login'


class NavigationLink extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    isSelected: React.PropTypes.bool,
    style: React.PropTypes.object,
    to: React.PropTypes.string,
  }

  state = {
    isFocused: false,
    isHovered: false,
  }

  render() {
    const {children, isSelected, style, ...extraProps} = this.props
    const isHighlighted = isSelected || this.state.isHovered || this.state.isFocused
    const containerStyle = {
      color: isHighlighted ? '#fff' : Colors.COOL_GREY,
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: 1,
      padding: 25,
      textDecoration: 'none',
      textTransform: 'uppercase',
      ...SmoothTransitions,
      ...style,
      ...(isHighlighted && style && style[':highlight'] || null),
    }

    return <Link
        {...extraProps} style={containerStyle}
        onMouseOut={() => this.setState({isHovered: false})}
        onMouseOver={() => this.setState({isHovered: true})}
        onFocus={() => this.setState({isFocused: true})}
        onBlur={() => this.setState({isFocused: false})}>
      {children}
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
      ':focus': {
        backgroundColor: Colors.RED_PINK_HOVER,
        color: '#fff',
      },
      ':hover': {
        backgroundColor: Colors.RED_PINK_HOVER,
        color: '#fff',
      },
      alignItems: 'center',
      color: '#fbd9e0',
      display: 'flex',
      height: MENU_LINK_HEIGHT,
      paddingLeft: 25,
      textAlign: 'left',
      ...style,
    }
    return <div {...extraProps} style={containerStyle}>
      {children}
    </div>
  }
}
const MenuLink = Radium(MenuLinkBase)


class MobileNavigationBar extends React.Component {
  static propTypes = {
    page: React.PropTypes.string,
  }

  state = {
    isMenuOpen: false,
  }

  render() {
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
      fontSize: 20,
      left: 0,
      padding: 15,
      position: 'absolute',
      top: 0,
    }
    const menuStyle = {
      backgroundColor: Colors.RED_PINK,
      color: '#fff',
      left: 0,
      paddingTop: 50,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
    }
    const linkStyle = page => ({
      color: page === this.props.page ? '#fff' : '#fbd9e0',
      display: 'block',
      padding: '20px 40px',
      textDecoration: 'none',
      textTransform: 'uppercase',
    })
    return <nav style={style}>
      {isMenuOpen ?
        <div style={menuStyle}>
          <Icon
              name="close" style={menuIconStyle} tabIndex={0}
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
        </div>
      :
      <Icon
          name="menu" style={menuIconStyle} tabIndex={0}
          onClick={() => this.setState({isMenuOpen: true})} />
      }
      <img src={require('images/logo-bob-mobile.svg')} alt={config.productName} />
    </nav>
  }
}


class NavigationBarBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    isMobileVersion: React.PropTypes.bool.isRequired,
    onboardingComplete: React.PropTypes.bool,
    page: React.PropTypes.string,
    style: React.PropTypes.object,
    userProfile: USER_PROFILE_SHAPE.isRequired,
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
    const {page, userProfile} = this.props
    if (page === 'profile' && !onboardingComplete(userProfile)) {
      return
    }
    if (userProfile && onboardingComplete(userProfile)) {
      browserHistory.push(Routes.DASHBOARD_PAGE)
      return
    }
    browserHistory.push(Routes.ROOT)
  }

  render() {
    const {isMobileVersion, onboardingComplete, page, style, userProfile} = this.props
    const {name} = userProfile
    const {isLogOutDropDownShown} = this.state
    if (isMobileVersion) {
      return <MobileNavigationBar page={page} />
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
      return <nav style={containerStyle}>
        {logo}

        <div style={{flex: 1}} />

        <NavigationLink to={Routes.ROOT} isSelected={page === 'landing'}>
          Accueil
        </NavigationLink>
        <NavigationLink to={Routes.VISION_PAGE} isSelected={page === 'vision'}>
          Notre mission
        </NavigationLink>
        <NavigationLink to={Routes.CONTRIBUTION_PAGE} isSelected={page === 'contribution'}>
          Contribuer
        </NavigationLink>
        <LoginButton style={{marginLeft: 25, marginRight: 13, textTransform: 'uppercase'}}>
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
        backgroundColor: Colors.RED_PINK_HOVER,
      },
      ':hover': {
        backgroundColor: Colors.RED_PINK_HOVER,
      },
      alignItems: 'center',
      backgroundColor: Colors.RED_PINK,
      bottom: 0,
      display: 'flex',
      justifyContent: 'center',
      left: 0,
      padding: 25,
      position: 'absolute',
      right: 0,
      top: 0,
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
      <MenuLink key="logout" onClick={this.logOut}>Déconnexion</MenuLink>,
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
      <NewProjectModal />
      {logo}

      <div style={{flex: 1}} />

      {onboardingComplete ? <div>
        <NavigationLink
          to={Routes.DASHBOARD_PAGE} isSelected={page === 'dashboard'}>
          Actions du jour
        </NavigationLink>
        <NavigationLink
            to={Routes.DISCOVERY_PAGE} isSelected={page === 'discovery'}>
          Métiers à explorer
        </NavigationLink>
        <NavigationLink
            to="https://aide.bob-emploi.fr/hc/fr" target="_blank"
            style={{padding: '25px 50px 25px 25px'}}>
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
const NavigationBar = connect(({app, user}) => ({
  isMobileVersion: app.isMobileVersion,
  onboardingComplete: onboardingComplete(user.profile),
  userProfile: user.profile,
}))(Radium(NavigationBarBase))


class FooterBase extends React.Component {
  static propTypes = {
    isMobileVersion: React.PropTypes.bool.isRequired,
    page: React.PropTypes.string,
    style: React.PropTypes.object,
  }

  render() {
    const {isMobileVersion, page, style} = this.props
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
            require('images/logo-bob-white-text.svg') :
            require('images/logo-bob-emploi-white.svg')}
          style={{height: 65, marginBottom: isMobileVersion ? 35 : 0}} />
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
const Footer = connect(({app}) => ({isMobileVersion: app.isMobileVersion}))(FooterBase)


class PageWithNavigationBar extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    isContentScrollable: React.PropTypes.bool,
    page: React.PropTypes.string,
    style: React.PropTypes.object,
  }

  render() {
    const {children, isContentScrollable, page, style, ...extraProps} = this.props
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
        <div style={scrollContainerStyle} {...extraProps}>
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
      <NavigationBar page={page} />
      {content}
    </div>
  }
}


export {Footer, NavigationBar, PageWithNavigationBar}
