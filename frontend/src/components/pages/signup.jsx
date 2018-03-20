import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'

import {LoginButton} from 'components/login'
import {PageWithNavigationBar} from 'components/navigation'


class VideoSignUpPage extends React.Component {
  static propTypes = {
    location: PropTypes.shape({
      search: PropTypes.string.isRequired,
    }).isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    email: parse(this.props.location.search).email,
  }

  render() {
    const {isMobileVersion} = this.context
    const style = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }
    const buttonStyle = {
      fontSize: 15,
      letterSpacing: 1,
      marginTop: 30,
      padding: '18px 28px 12px',
      textTransform: 'uppercase',
    }
    return <PageWithNavigationBar isContentScrollable={true} style={style}>
      <iframe
        width={isMobileVersion ? 320 : 900} height={isMobileVersion ? 200 : 506}
        allowFullScreen={true}
        src="https://www.youtube.com/embed/KSsVpeFqcaU?autoplay=1" frameBorder="0" />
      <LoginButton
        style={buttonStyle} email={this.state.email}
        isSignUpButton={true} visualElement="video-signup" type="navigation">
        Inscrivez vous, c'est gratuit&nbsp;!
      </LoginButton>
    </PageWithNavigationBar>
  }
}


export {VideoSignUpPage}
