import React from 'react'
import ReactDOM from 'react-dom'
import {AppContainer} from 'react-hot-loader'

import {App} from 'components/pages/eval'


ReactDOM.render(
  <AppContainer>
    <App />
  </AppContainer>,
  document.getElementById('app'),
)


// Hot Module Replacement API
if (module.hot) {
  module.hot.accept('./components/pages/eval', () => {
    const NextApp = require('./components/pages/eval').App
    ReactDOM.render(
      <AppContainer>
        <NextApp />
      </AppContainer>,
      document.getElementById('app'),
    )
  })
}
