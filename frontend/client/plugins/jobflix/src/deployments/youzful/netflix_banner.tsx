import React from 'react'
import Trans from 'components/i18n_trans'

import isMobileVersion from 'store/mobile'

import bannerImage from './banner.svg'

const bannerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundImage: `url(${bannerImage})`,
  backgroundPosition: 'center, center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  color: '#fff',
  display: 'flex',
  fontWeight: 'bold',
  width: '100%',
  ...isMobileVersion ? {
    fontSize: 20,
    padding: 25,
  } : {
    fontSize: 50,
    padding: '100px 180px',
  },
}

const YouzfulBanner = () =>
  <Trans style={bannerStyle}>
    Des idées de métiers dans votre département&nbsp;!
  </Trans>

export default React.memo(YouzfulBanner)
