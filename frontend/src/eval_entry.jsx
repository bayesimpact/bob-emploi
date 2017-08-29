import React from 'react'
import ReactDOM from 'react-dom'
import {AppContainer} from 'react-hot-loader'
import injectTapEventPlugin from 'react-tap-event-plugin'

import {App} from 'components/pages/eval'

// Needed to remove delay for onClick on iOS.
injectTapEventPlugin()


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
