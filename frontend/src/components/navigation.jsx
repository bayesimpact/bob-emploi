import omit from 'lodash/omit'
import AccountCircleIcon from 'mdi-react/AccountCircleIcon'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import MenuIcon from 'mdi-react/MenuIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {Link} from 'react-router-dom'
import {connect} from 'react-redux'

import config from 'config'
import {logoutAction, modifyProject, openLoginModal} from 'store/actions'
import {onboardingComplete} from 'store/main_selectors'

import bellImage from 'images/bell.svg'
import facebookImage from 'images/facebook.svg'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'
import logoProductBetaImage from 'images/logo-bob-beta.svg'
import twitterImage from 'images/twitter.svg'

import {DebugModal} from 'components/debug'
import {FastForward} from 'components/fast_forward'
import {ShortKey} from 'components/shortkey'
import {STATIC_ADVICE_MODULES} from 'components/static_advice'
import {Modal} from 'components/modal'
import {CookieMessage} from './cookie_message'
import {BetaMessage} from './beta_message'
import {Button, Colors, MAX_CONTENT_WIDTH, MIN_CONTENT_PADDING,
  OutsideClickHandler, SmoothTransitions, Styles, UpDownIcon} from './theme'
import {Routes} from './url'
import {ZendeskChatButton} from 'components/zendesk'

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
      borderTop: index ? `solid 1px ${Colors.BACKGROUND_GREY}` : 'initial',
      color: Colors.DARK_TWO,
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
      fill: Colors.CHARCOAL_GREY,
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
  color: Colors.COOL_GREY,
  fontSize: 13,
  fontWeight: 500,
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
      textShadow: isHighlighted ? '0 1px 2px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.9)',
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


class MenuLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  render() {
    const {children, style, ...extraProps} = this.props
    const containerStyle = {
      alignItems: 'center',
      color: Colors.DARK_TWO,
      display: 'flex',
      fontWeight: 'normal',
      height: MENU_LINK_HEIGHT,
      paddingLeft: 25,
      textAlign: 'left',
      ...style,
      // eslint-disable-next-line sort-keys
      ':focus': {
        backgroundColor: Colors.BOB_BLUE,
        color: '#fff',
        ...(style && style[':hover'] || {}),
      },
      ':hover': {
        backgroundColor: Colors.BOB_BLUE,
        color: '#fff',
        ...(style && style[':hover'] || {}),
      },
    }
    return <div {...extraProps} style={containerStyle}>
      {children}
    </div>
  }
}
const MenuLink = Radium(MenuLinkBase)


class NavigationBarBase extends React.Component {
  static propTypes = {
    // Allow only one child: it will be part of a flex flow so it can use
    // alignSelf to change its own layout.
    children: PropTypes.element,
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.shape({
      poleEmploi: PropTypes.bool,
    }).isRequired,
    isLoggedIn: PropTypes.bool.isRequired,
    isOnboardingComplete: PropTypes.bool,
    isTransparent: PropTypes.bool,
    onBackClick: PropTypes.func,
    page: PropTypes.string,
    project: PropTypes.shape({
      projectId: PropTypes.string,
    }),
    style: PropTypes.object,
    userProfile: PropTypes.shape({
      name: PropTypes.string,
    }).isRequired,
  }

  static contextTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    isMobileVersion: PropTypes.bool.isRequired,
  }

  state = {
    isLogOutDropDownShown: false,
    isMobileMenuOpen: false,
    isModifyProjectModalShown: false,
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  closeMobileMenu = () => {
    this.timeout = setTimeout(() => this.setState({isMobileMenuOpen: false}), 50)
  }

  logOut = event => {
    event.stopPropagation()
    this.props.dispatch(logoutAction)
    this.context.history.push(Routes.ROOT)
  }

  toggleMenuDropDown = () => {
    this.setState({isLogOutDropDownShown: !this.state.isLogOutDropDownShown})
  }

  collapseDropDown = () => {
    this.setState({isLogOutDropDownShown: false})
  }

  handleLogoClick = () => {
    const {page, isOnboardingComplete} = this.props
    if ((page === 'profile' || page === 'new_project') && !isOnboardingComplete) {
      return
    }
    this.context.history.push(Routes.ROOT)
  }

  renderOnMobile() {
    const {children, dispatch, isLoggedIn, onBackClick, project} = this.props
    const {isMobileMenuOpen, isModifyProjectModalShown} = this.state
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.DARK,
      color: '#fff',
      display: 'flex',
      height: 50,
      justifyContent: 'center',
      position: 'relative',
    }
    const backIconStyle = {
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
    const menuIconStyle = {
      alignItems: 'center',
      display: 'flex',
      fill: isLoggedIn && !isMobileMenuOpen ? Colors.SLATE : '#fff',
      height: 50,
      justifyContent: 'center',
      left: isLoggedIn ? 'initial' : 0,
      padding: isLoggedIn ? 10 : 15,
      position: 'absolute',
      right: isLoggedIn ? 0 : 'initial',
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
      zIndex: 2,
    }
    const linkStyle = page => ({
      backgroundColor: page === this.props.page ? Colors.RED_PINK : 'inherit',
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
        {onBackClick ? <ChevronLeftIcon
          style={backIconStyle} onClick={onBackClick}
        /> : null}
        {isMobileMenuOpen ?
          <OutsideClickHandler onOutsideClick={this.closeMobileMenu}>
            <div style={menuStyle}>
              <CloseIcon
                onClick={() => this.setState({isMobileMenuOpen: false})}
                style={menuIconStyle}
              />
              {isLoggedIn ? <React.Fragment>
                {isProjectModifiable ? <a
                  style={linkStyle()}
                  onClick={() => {
                    this.closeMobileMenu()
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
                <a style={linkStyle('logout')} onClick={this.logOut}>
                  Déconnexion
                </a>
              </React.Fragment> : <React.Fragment>
                <Link to={Routes.ROOT} style={linkStyle('landing')}>
                  Accueil
                </Link>
                <Link to={Routes.VISION_PAGE} style={linkStyle('vision')}>
                  Notre mission
                </Link>
                <Link to={Routes.TEAM_PAGE} style={linkStyle('equipe')}>
                  Qui est Bob&nbsp;?
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
            onClick={() => this.setState({isMobileMenuOpen: true})} />
        }
        <Link to={Routes.ROOT}>
          <img src={logoProductWhiteImage} alt={config.productName} style={{height: 22}} />
        </Link>
      </nav>
      {children}
    </React.Fragment>
  }

  render() {
    const {dispatch, children, featuresEnabled, isLoggedIn, isTransparent,
      page, project, style, userProfile} = this.props
    const {isMobileVersion, history} = this.context
    const {name} = userProfile
    const {isLogOutDropDownShown, isModifyProjectModalShown} = this.state
    if (isMobileVersion) {
      return this.renderOnMobile()
    }
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: isTransparent ? 'initial' : Colors.DARK,
      color: '#fff',
      display: 'flex',
      height: NAVIGATION_BAR_HEIGHT,
      justifyContent: 'flex-end',
      position: isTransparent ? 'absolute' : 'relative',
      width: '100%',
      zIndex: isTransparent ? 2 : 'initial',
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
    const logoStyle = {
      cursor: 'pointer',
      height: 30,
    }
    const logo = <img
      src={logoProductBetaImage}
      style={logoStyle}
      onClick={this.handleLogoClick} alt={config.productName} />
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
            {logo}
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
        backgroundColor: isLogOutDropDownShown ? '#fff' : 'rgba(255, 255, 255, .2)',
      },
      alignItems: 'center',
      backgroundColor: isLogOutDropDownShown ? '#fff' : 'initial',
      bottom: 0,
      color: isLogOutDropDownShown ? Colors.DARK_TWO : '#fff',
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
    const isProjectModifiable = project && project.projectId && !project.isIncomplete
    const menuItems = [
      <MenuLink key="profile" onClick={() => history.push(Routes.PROFILE_PAGE)}>
        Vos informations
      </MenuLink>,
      isProjectModifiable ? <MenuLink
        key="modify-project"
        onClick={() => this.setState({isModifyProjectModalShown: true})}>
        Modifer votre projet
      </MenuLink> : null,
      <MenuLink key="contribute" onClick={() => history.push(Routes.CONTRIBUTION_PAGE)}>
        Contribuer
      </MenuLink>,
      <MenuLink key="help" onClick={() => openInNewTab('https://aide.bob-emploi.fr/hc/fr')}>
        Aide
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
    ].filter(menuLink => menuLink)
    const dropDownStyle = {
      ...linkContainerStyle,
      alignItems: 'center',
      backgroundColor: dropDownButtonStyle.backgroundColor,
      borderTop: isLogOutDropDownShown ? 'solid 1px rgba(255, 255, 255, .2)' : 'none',
      fontWeight: isLogOutDropDownShown ? 'bold' : 500,
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
    return <nav style={containerStyle}>
      {isProjectModifiable ? <ModifyProjectModal
        isShown={isModifyProjectModalShown}
        onClose={() => this.setState({isModifyProjectModalShown: false})}
        onConfirm={() => dispatch(modifyProject(project))} /> : null}
      <div style={logoOnLeftStyle}>
        {logo}
      </div>

      {children ? React.cloneElement(children, {
        style: {
          flex: 1,
          textAlign: 'center',
          ...children.props.style,
        },
      }) : <span style={{flex: 1}} />}

      <Notifications
        page={page} notifications={featuresEnabled.poleEmploi ? [
          {
            href: 'https://projects.invisionapp.com/boards/SK39VCS276T8J/',
            subtitle: 'Trouvez ici nos resources pour présenter Bob',
            title: 'Vous êtes conseiller Pôle emploi ?',
          },
        ] : []} />

      <div
        style={menuStyle} onClick={this.toggleMenuDropDown}
        onBlur={this.collapseDropDown} tabIndex="0">
        <div style={dropDownButtonStyle}>
          {name}&nbsp;<div style={{flex: 1}} /><UpDownIcon
            icon="menu"
            isUp={isLogOutDropDownShown}
            style={menuIconStyle} />
        </div>
        <div style={dropDownStyle}>
          {menuItems}
        </div>
      </div>
    </nav>
  }
}
const NavigationBar = connect(({user}) => ({
  featuresEnabled: user.featuresEnabled || {},
  isLoggedIn: !!(user.profile && user.profile.name),
  isOnboardingComplete: onboardingComplete(user),
  project: user.projects && user.projects[0],
  userProfile: user.profile,
}))(Radium(NavigationBarBase))


const RadiumLink = Radium(Link)
class FooterLink extends React.Component {
  static propTypes = {
    isSelected: PropTypes.bool,
    style: PropTypes.object,
  }

  render() {
    const style = {
      ':focus': {
        color: '#fff',
      },
      ':hover': {
        color: '#fff',
      },
      color: this.props.isSelected ? '#fff' : Colors.COOL_GREY,
      display: 'block',
      fontSize: 13,
      fontWeight: 'bold',
      padding: '5px 0',
      textDecoration: 'none',
      ...SmoothTransitions,
      ...this.props.style,
    }
    return <RadiumLink style={style} {...omit(this.props, ['isSelected', 'style'])} />
  }
}


class Footer extends React.Component {
  static propTypes = {
    page: PropTypes.string,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool.isRequired,
  }

  renderLinkSection(title, border, children) {
    const {isMobileVersion} = this.context
    const linkPadding = isMobileVersion ? 12 : 10
    const containerStyle = {
      paddingBottom: linkPadding,
      paddingTop: linkPadding,
      width: 170,
    }
    const headerStyle = {
      color: '#fff',
      fontSize: 11,
      marginBottom: 15,
      textTransform: 'uppercase',
    }
    return <section style={containerStyle}>
      <header style={headerStyle}>
        {title}
      </header>

      {children}
    </section>
  }

  render() {
    const {page, style} = this.props
    const {isMobileVersion} = this.context
    const containerStyle = {
      backgroundColor: Colors.DARK_BLUE,
      color: Colors.COOL_GREY,
      fontFamily: 'Lato, Helvetica',
      padding: isMobileVersion ? '35px 0' : `80px ${MIN_CONTENT_PADDING}px`,
      textAlign: isMobileVersion ? 'center' : 'left',
      ...style,
    }
    const linksContainerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      fontWeight: 'bold',
      padding: '20px 0',
    }
    const logoStyle = {
      height: 30,
      marginBottom: isMobileVersion ? 35 : 0,
    }
    const iconPadding = 8
    const iconStyle = {
      ':highlight': {opacity: 1},
      display: 'block',
      fontSize: 'inherit',
      fontWeight: 'inherit',
      marginLeft: 'initial',
      opacity: .5,
      paddingBottom: iconPadding,
      paddingLeft: iconPadding,
      paddingRight: iconPadding,
      paddingTop: iconPadding,
    }
    return <footer style={containerStyle}>
      <div style={{margin: 'auto', maxWidth: MAX_CONTENT_WIDTH}}>
        <div style={{textAlign: isMobileVersion ? 'center' : 'initial'}}>
          <img src={logoProductWhiteImage} style={logoStyle} alt={config.productName} />
        </div>

        <div style={linksContainerStyle}>
          <div style={{...linksContainerStyle, alignItems: 'stretch'}}>
            {this.renderLinkSection(config.productName, 'left', <React.Fragment>
              <FooterLink to={Routes.ROOT} isSelected={page === 'landing'}>
                Découvrir
              </FooterLink>

              <FooterLink to={Routes.TRANSPARENCY_PAGE} isSelected={page === 'transparency'}>
                Métriques
              </FooterLink>
            </React.Fragment>)}

            {this.renderLinkSection('Nos conseils', null, <React.Fragment>
              {STATIC_ADVICE_MODULES.map(({adviceId, name}) =>
                <FooterLink
                  to={Routes.STATIC_ADVICE_PAGE(adviceId)}
                  isSelected={page === `static-${adviceId}`} key={adviceId}>
                  {name}
                </FooterLink>)}
            </React.Fragment>)}

            {this.renderLinkSection('À propos', null, <React.Fragment>
              <FooterLink to={Routes.TEAM_PAGE} isSelected={page === 'equipe'}>
                Équipe
              </FooterLink>

              <FooterLink to="https://www.bayesimpact.org" target="_blank" rel="noopener noreferrer">
                Bayes Impact
              </FooterLink>
            </React.Fragment>)}

            {this.renderLinkSection('Aide', null, <React.Fragment>
              <FooterLink
                target="_blank" to={config.helpRequestUrl} rel="noopener noreferrer">
                Nous contacter
              </FooterLink>

              <FooterLink to={Routes.PROFESSIONALS_PAGE} isSelected={page === 'professionals'}>
                Accompagnateurs
              </FooterLink>

              <FooterLink to={Routes.CONTRIBUTION_PAGE} isSelected={page === 'contribution'}>
                Contribuer
              </FooterLink>
            </React.Fragment>)}

            {this.renderLinkSection('Légal', null, <React.Fragment>
              <FooterLink to={Routes.TERMS_AND_CONDITIONS_PAGE} isSelected={page === 'terms'}>
                CGU
              </FooterLink>

              <FooterLink to={Routes.PRIVACY_PAGE} isSelected={page === 'privacy'}>
                Vie privée
              </FooterLink>

              <FooterLink to={Routes.COOKIES_PAGE} isSelected={page === 'cookies'}>
                Cookies
              </FooterLink>
            </React.Fragment>)}
          </div>

          <div style={{flex: 1}} />

          <NavigationLink
            style={iconStyle} to="https://www.facebook.com/bobemploi" target="_blank"
            rel="noopener noreferrer">
            <img src={facebookImage} alt="Facebook" />
          </NavigationLink>

          <NavigationLink
            style={{...iconStyle, paddingRight: isMobileVersion ? iconPadding : 0}}
            to="https://twitter.com/bobemploi" target="_blank"
            rel="noopener noreferrer">
            <img src={twitterImage} alt="Twitter" />
          </NavigationLink>
        </div>
      </div>
    </footer>
  }
}


class PageWithNavigationBar extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    isChatButtonShown: PropTypes.bool,
    isContentScrollable: PropTypes.bool,
    isCookieDisclaimerShown: PropTypes.bool,
    isNavBarTransparent: PropTypes.bool,
    navBarContent: PropTypes.element,
    onBackClick: PropTypes.func,
    onScroll: PropTypes.func,
    page: PropTypes.string,
    style: PropTypes.object,
  }

  static defaultProps = {
    isCookieDisclaimerShown: true,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
    store: PropTypes.shape({
      getState: PropTypes.func.isRequired,
    }).isRequired,
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

  getUserProfile() {
    const {store} = this.context
    const {profile} = store.getState().user
    return profile
  }

  render() {
    const {children, isChatButtonShown, isContentScrollable, isCookieDisclaimerShown,
      isNavBarTransparent, navBarContent, onBackClick, onScroll, page, style,
      ...extraProps} = this.props
    const {isMobileVersion} = this.context
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
    return <div style={containerStyle}>
      {isCookieDisclaimerShown ? <CookieMessage style={{flexShrink: 0}} /> : null}
      <BetaMessage style={{flexShrink: 0}} />
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <NavigationBar
          page={page} onBackClick={onBackClick}
          isTransparent={isNavBarTransparent} style={{flexShrink: 0}}>
          {navBarContent}
        </NavigationBar>
        <ZendeskChatButton
          isShown={isChatButtonShown && !isMobileVersion} language="fr"
          domain={config.zendeskDomain} user={this.getUserProfile()} />

        <ShortKey
          keyCode="KeyE" hasCtrlModifier={true} hasShiftModifier={true}
          onKeyPress={() => this.setState({isDebugModalShown: true})} />
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

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {onClose, onConfirm, ...extraProps} = this.props
    const {isMobileVersion} = this.context
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


export {Footer, ModifyProjectModal, NavigationBar, PageWithNavigationBar}
