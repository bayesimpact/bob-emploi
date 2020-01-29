import React from 'react'

import loadingImage from 'images/logo-bob-loading.svg'


const style: React.CSSProperties = {
  alignItems: 'center',
  background: '#fff',
  boxSizing: 'border-box',
  display: 'flex',
  height: '100%',
  justifyContent: 'center',
  position: 'fixed',
  width: '100vw',
}


// Keep this component in sync with index.html.
const WaitingPage: React.FC = (): React.ReactElement => {
  return <div style={style}>
    <img src={loadingImage} alt="Chargement…" />
  </div>
}
const WaitingPageMemo = React.memo(WaitingPage)


export {WaitingPageMemo as WaitingPage}
