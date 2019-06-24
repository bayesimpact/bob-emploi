import React from 'react'
import {LoadingComponentProps} from 'react-loadable'

import loadingImage from 'images/logo-bob-loading.svg'


// Keep this class in sync with index.html.
class WaitingPage extends React.PureComponent<LoadingComponentProps> {
  public render(): React.ReactNode {
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
    return <div style={style}>
      <img src={loadingImage} alt="Chargement…" />
    </div>
  }
}


export {WaitingPage}
