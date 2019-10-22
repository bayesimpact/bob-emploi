import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'

import {LoginLink} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {Button} from 'components/theme'


interface PageProps {
  location: {
    search: string
  }
}


interface PageState {
  email: string
}


export default class VideoSignUpPage extends React.PureComponent<PageProps, PageState> {
  public static propTypes = {
    location: PropTypes.shape({
      search: PropTypes.string.isRequired,
    }).isRequired,
  }

  public state = {
    email: parse(this.props.location.search).email,
  }

  public render(): React.ReactNode {
    const style: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }
    const buttonStyle: React.CSSProperties = {
      fontSize: 15,
      letterSpacing: 1,
      padding: '18px 28px',
      textTransform: 'uppercase',
    }
    return <PageWithNavigationBar isContentScrollable={true} style={style}>
      <iframe
        width={isMobileVersion ? 320 : 900} height={isMobileVersion ? 200 : 506}
        allowFullScreen={true}
        src="https://www.youtube.com/embed/KSsVpeFqcaU?autoplay=1" frameBorder="0" />
      <LoginLink
        style={{marginTop: 30}} email={this.state.email}
        isSignUp={true} visualElement="video-signup">
        <Button style={buttonStyle} type="navigation">
          Commencez, c'est gratuit&nbsp;!
        </Button>
      </LoginLink>
    </PageWithNavigationBar>
  }
}
