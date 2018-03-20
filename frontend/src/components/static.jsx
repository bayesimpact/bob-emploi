import React from 'react'
import PropTypes from 'prop-types'

import {LoginButton} from 'components/login'
import {Footer, PageWithNavigationBar} from 'components/navigation'
import {Colors, MIN_CONTENT_PADDING, MAX_CONTENT_WIDTH} from 'components/theme'
import {Waves} from 'components/waves'


class StrongTitle extends React.Component {
  static propTypes = {
    children: PropTypes.node,
  }

  render() {
    return <strong style={{color: Colors.BOB_BLUE}}>
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

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {children, page, style, title, ...extraProps} = this.props
    const {isMobileVersion} = this.context
    const pageStyle = {
      backgroundColor: '#fff',
      color: Colors.CHARCOAL_GREY,
      margin: 'auto',
      maxWidth: 1200,
      overflowX: 'hidden',
    }
    const headerStyle = {
      alignItems: 'center',
      alignSelf: 'center',
      color: Colors.SLATE,
      display: 'flex',
      fontSize: 50,
      justifyContent: 'center',
      lineHeight: 1,
      minHeight: 200,
      padding: isMobileVersion ? '20px 0' : 'initial',
      textAlign: 'center',
    }
    const separatorStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
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


class TitleWavesSection extends React.Component {
  static propTypes = {
    isLoginButtonShown: PropTypes.bool,
    isNarrow: PropTypes.bool,
    pageContent: PropTypes.shape({
      buttonCaption: PropTypes.string,
      fontSize: PropTypes.number,
      subtitle: PropTypes.string,
      title: PropTypes.node.isRequired,
    }).isRequired,
    style: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  renderLoginButtons() {
    const {pageContent} = this.props
    const {isMobileVersion} = this.context
    const {buttonCaption} = pageContent
    const buttonStyle = {
      fontSize: 15,
      marginTop: isMobileVersion ? 10 : 0,
      padding: '15px 28px 12px',
    }
    return <div>
      <LoginButton
        style={buttonStyle} isSignUpButton={true} visualElement="title" type="validation">
        {buttonCaption || 'Inscrivez-vous maintenant !'}
      </LoginButton>
    </div>
  }

  render() {
    const {isLoginButtonShown, isNarrow, pageContent} = this.props
    const {isMobileVersion} = this.context
    const {fontSize, subtitle, title} = pageContent
    const backgroundHeight = isNarrow ? 250 : 300
    const style = {
      backgroundColor: '#fff',
      color: '#fff',
      fontSize: isMobileVersion ? 39 : (fontSize || 55),
      padding: isMobileVersion ? '0 10px 60px' : `60px ${MIN_CONTENT_PADDING}px`,
      position: 'relative',
      textAlign: isMobileVersion ? 'center' : 'left',
      zIndex: 0,
      ...this.props.style,
    }
    const backgroundStyle = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: -1,
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
      <div style={backgroundStyle}>
        <div
          style={{backgroundColor: Colors.BOB_BLUE,
            height: isMobileVersion ? backgroundHeight : backgroundHeight + 10}} />
        <Waves style={{maxHeight: 250, transform: 'translateY(-2px)', width: '100%'}} />
      </div>
      <div style={{margin: '0 auto', maxWidth: MAX_CONTENT_WIDTH, padding: '40px 0 20px'}}>
        <h1 style={titleStyle}>{title}</h1>
        {subtitle ? <div style={subTitleStyle}>{subtitle}</div> : <div style={{height: 30}} />}
        {isLoginButtonShown ? this.renderLoginButtons() : null}
      </div>
    </section>
  }
}


export {StaticPage, StrongTitle, TitleWavesSection}
