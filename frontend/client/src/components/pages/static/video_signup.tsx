import PropTypes from 'prop-types'
import React, {useState} from 'react'

import {parseQueryString} from 'store/parse'

import {LoginButton} from 'components/login'
import isMobileVersion from 'store/mobile'
import {PageWithNavigationBar} from 'components/navigation'


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
  marginTop: 30,
  padding: '18px 28px',
  textTransform: 'uppercase',
}


const VideoSignUpPage = ({location: {search}}: PageProps): React.ReactElement => {
  const [email] = useState(parseQueryString(search).email)
  return <PageWithNavigationBar isContentScrollable={true} style={style}>
    <iframe
      width={isMobileVersion ? 320 : 900} height={isMobileVersion ? 200 : 506}
      allowFullScreen={true}
      src="https://www.youtube.com/embed/KSsVpeFqcaU?autoplay=1" frameBorder="0"
      title={`Pourquoi ${config.productName}, par Paul Duan`} />
    <LoginButton
      style={buttonStyle} email={email} type="navigation"
      isSignUp={true} visualElement="video-signup">
      Commencez, c'est gratuit&nbsp;!
    </LoginButton>
  </PageWithNavigationBar>
}
VideoSignUpPage.propTypes = {
  location: PropTypes.shape({
    search: PropTypes.string.isRequired,
  }).isRequired,
}



export default React.memo(VideoSignUpPage)
