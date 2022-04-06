import React, {Suspense} from 'react'
import {hot} from 'react-hot-loader/root'
import {BrowserRouter, Route, Switch} from 'react-router-dom'

import 'styles/App.css'

import EmailsPage from 'pages/emails'
import VersionPage from 'pages/versions'
import TablesPage from 'pages/tables'


const App = (): React.ReactElement => {
  return <Suspense fallback="Loading…">
    <BrowserRouter>
      <Switch>
        <Route path="/collections/:site" component={TablesPage} />
        <Route path="/emails/:site" component={EmailsPage} />
        <Route path="/" component={VersionPage} />
      </Switch>
    </BrowserRouter>
  </Suspense>
}

export default hot(React.memo(App))
