import React from 'react'
import ReactDOM from 'react-dom'
import {AppContainer} from 'react-hot-loader'

import {App} from 'components/pages/bootstrap'


ReactDOM.render(
  <AppContainer>
    <App />
  </AppContainer>,
  document.getElementById('app'),
)


// Hot Module Replacement API
if (module.hot) {
  module.hot.accept('./components/pages/bootstrap', (): void => {
    const NextApp = require('./components/pages/bootstrap').App
    ReactDOM.render(
      <AppContainer>
        <NextApp />
      </AppContainer>,
      document.getElementById('app'),
    )
  })
}
