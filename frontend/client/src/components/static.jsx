import _omit from 'lodash/omit'
import Radium from 'radium'
import React from 'react'
import {Link} from 'react-router-dom'
import PropTypes from 'prop-types'

import facebookImage from 'images/facebook.svg'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'
import twitterImage from 'images/twitter.svg'

import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {STATIC_ADVICE_MODULES} from 'components/pages/static/static_advice/base'
import {ExternalLink, MIN_CONTENT_PADDING, MAX_CONTENT_WIDTH,
  SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'


const RadiumLink = Radium(Link)
const RadiumExternalLink = Radium(ExternalLink)
class FooterLink extends React.Component {
  static propTypes = {
    isSelected: PropTypes.bool,
    style: PropTypes.object,
    to: PropTypes.string,
  }

  render() {
    const style = {
      ':focus': {
        color: '#fff',
      },
      ':hover': {
        color: '#fff',
      },
      color: this.props.isSelected ? '#fff' : colors.COOL_GREY,
      display: 'block',
      fontSize: 13,
      fontWeight: 'bold',
      padding: '5px 0',
      textDecoration: 'none',
      ...SmoothTransitions,
      ...this.props.style,
    }
    const LinkComponent = this.props.to ? RadiumLink : RadiumExternalLink
    return <LinkComponent style={style} {..._omit(this.props, ['isSelected', 'style'])} />
  }
}


class Footer extends React.Component {
  static propTypes = {
    page: PropTypes.string,
    style: PropTypes.object,
  }

  renderLinkSection(title, border, children) {
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
    const containerStyle = {
      backgroundColor: colors.DARK_BLUE,
      color: colors.COOL_GREY,
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
      ':focus': {opacity: 1},
      ':hover': {opacity: 1},
      cursor: 'pointer',
      display: 'block',
      fontSize: 'inherit',
      fontWeight: 'inherit',
      marginLeft: 'initial',
      opacity: .5,
      paddingBottom: iconPadding,
      paddingLeft: iconPadding,
      paddingRight: iconPadding,
      paddingTop: iconPadding,
      ...SmoothTransitions,
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
                  to={Routes.STATIC_ADVICE_PAGE + `/${adviceId}`}
                  isSelected={page === `static-${adviceId}`} key={adviceId}>
                  {name}
                </FooterLink>)}
            </React.Fragment>)}

            {this.renderLinkSection('À propos', null, <React.Fragment>
              <FooterLink to={Routes.TEAM_PAGE} isSelected={page === 'equipe'}>
                Équipe
              </FooterLink>

              <FooterLink href="https://www.bayesimpact.org">
                Bayes Impact
              </FooterLink>
            </React.Fragment>)}

            {this.renderLinkSection('Aide', null, <React.Fragment>
              <FooterLink href={config.helpRequestUrl}>
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

          <RadiumExternalLink style={iconStyle} href="https://www.facebook.com/bobemploi">
            <img src={facebookImage} alt="Facebook" />
          </RadiumExternalLink>

          <RadiumExternalLink
            style={{...iconStyle, paddingRight: isMobileVersion ? iconPadding : 0}}
            href="https://twitter.com/bobemploi">
            <img src={twitterImage} alt="Twitter" />
          </RadiumExternalLink>
        </div>
      </div>
    </footer>
  }
}


class StrongTitle extends React.Component {
  static propTypes = {
    children: PropTypes.node,
  }

  render() {
    return <strong style={{color: colors.BOB_BLUE}}>
      {this.props.children}
    </strong>
  }
}


class StaticPage extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    page: PropTypes.string.isRequired,
    style: PropTypes.object,
    // The title of the page. If not set, the layout is quite different as we
    // drop not only the title but also the separator and the "paper sheet"
    // style.
    title: PropTypes.node,
  }

  render() {
    const {children, page, style, title, ...extraProps} = this.props
    const pageStyle = {
      backgroundColor: '#fff',
      color: colors.CHARCOAL_GREY,
      margin: 'auto',
      maxWidth: 1200,
      overflowX: 'hidden',
    }
    const headerStyle = {
      alignItems: 'center',
      alignSelf: 'center',
      color: colors.SLATE,
      display: 'flex',
      fontFamily: style && style.fontFamily || 'inherit',
      fontSize: 50,
      justifyContent: 'center',
      lineHeight: 1,
      minHeight: 200,
      padding: isMobileVersion ? '20px 0' : 'initial',
      textAlign: 'center',
    }
    const separatorStyle = {
      backgroundColor: colors.BACKGROUND_GREY,
      border: 'none',
      height: 1,
      width: '100%',
    }
    return <PageWithNavigationBar
      style={{...(title ? {} : style)}}
      page={page} isContentScrollable={true} {...extraProps}>
      {title ? (
        <div style={pageStyle}>
          <header style={headerStyle}>
            {title}
          </header>

          <hr style={separatorStyle} />

          <div style={{flex: 1, padding: isMobileVersion ? 20 : 100, ...style}}>
            {children}
          </div>
        </div>
      ) : <div style={{flexShrink: 0}}>{children}</div>}

      <Footer page={page} style={{flexShrink: 0}} />
    </PageWithNavigationBar>
  }
}


class TitleSection extends React.Component {
  static propTypes = {
    isLoginButtonShown: PropTypes.bool,
    pageContent: PropTypes.shape({
      buttonCaption: PropTypes.string,
      fontSize: PropTypes.number,
      subtitle: PropTypes.string,
      title: PropTypes.node.isRequired,
    }).isRequired,
    style: PropTypes.object,
  }

  renderLoginButtons() {
    const {pageContent} = this.props
    const {buttonCaption} = pageContent
    const buttonStyle = {
      fontSize: 15,
      marginTop: isMobileVersion ? 10 : 0,
      padding: '15px 28px',
    }
    return <div>
      <LoginButton
        style={buttonStyle} isSignUpButton={true} visualElement="title" type="validation">
        {buttonCaption || 'Inscrivez-vous maintenant !'}
      </LoginButton>
    </div>
  }

  render() {
    const {isLoginButtonShown, pageContent} = this.props
    const {fontSize, subtitle, title} = pageContent
    const style = {
      backgroundColor: colors.BOB_BLUE,
      color: '#fff',
      fontSize: isMobileVersion ? 39 : (fontSize || 55),
      padding: isMobileVersion ? '0 10px 60px' : `60px ${MIN_CONTENT_PADDING}px`,
      position: 'relative',
      textAlign: isMobileVersion ? 'center' : 'left',
      zIndex: 0,
      ...this.props.style,
    }
    const titleStyle = {
      fontSize: isMobileVersion ? 35 : 55,
      fontWeight: 'bold',
      maxWidth: 700,
    }
    const subTitleStyle = {
      fontSize: isMobileVersion ? 20 : 25,
      marginBottom: 20,
    }
    return <section style={style}>
      <div style={{margin: '0 auto', maxWidth: MAX_CONTENT_WIDTH, padding: '40px 0 20px'}}>
        <h1 style={titleStyle}>{title}</h1>
        {subtitle ? <div style={subTitleStyle}>{subtitle}</div> : <div style={{height: 30}} />}
        {isLoginButtonShown ? this.renderLoginButtons() : null}
      </div>
    </section>
  }
}


export {StaticPage, StrongTitle, TitleSection}
