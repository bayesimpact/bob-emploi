import React from 'react'

import WaitingPage from 'components/pages/waiting'
import loadingImage from '../../images/loading.svg'

const style: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_WELCOME,
}


const JobflixWaitingPage = () => <WaitingPage
  loadingImage={config.hasDeploymentImages ? '' : loadingImage} style={style} />
export default React.memo(JobflixWaitingPage)
