import PropTypes from 'prop-types'
import React, {useState} from 'react'

import {parseQueryString} from 'store/parse'

import {LoginLink} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {Button} from 'components/theme'


interface PageProps {
  location: {
    search: string
  }
}


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
const linkStyle = {
  marginTop: 30,
}


const VideoSignUpPage = ({location: {search}}: PageProps): React.ReactElement => {
  const [email] = useState(parseQueryString(search).email)
  return <PageWithNavigationBar isContentScrollable={true} style={style}>
    <iframe
      width={isMobileVersion ? 320 : 900} height={isMobileVersion ? 200 : 506}
      allowFullScreen={true}
      src="https://www.youtube.com/embed/KSsVpeFqcaU?autoplay=1" frameBorder="0" />
    <LoginLink
      style={linkStyle} email={email}
      isSignUp={true} visualElement="video-signup">
      <Button style={buttonStyle} type="navigation">
        Commencez, c'est gratuit&nbsp;!
      </Button>
    </LoginLink>
  </PageWithNavigationBar>
}
VideoSignUpPage.propTypes = {
  location: PropTypes.shape({
    search: PropTypes.string.isRequired,
  }).isRequired,
}



export default React.memo(VideoSignUpPage)
