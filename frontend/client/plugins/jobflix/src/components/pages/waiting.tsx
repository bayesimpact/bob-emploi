import React from 'react'

import WaitingPage from 'components/pages/waiting'
import loadingImage from '../../images/loading.svg'

const style: React.CSSProperties = {
  backgroundColor: colors.PURPLE_BROWN,
}


const JobflixWaitingPage = () => <WaitingPage loadingImage={loadingImage} style={style} />
export default React.memo(JobflixWaitingPage)
