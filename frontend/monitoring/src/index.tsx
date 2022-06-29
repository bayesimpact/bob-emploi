import React from 'react'
import ReactDOMServer from 'react-dom/server'

import favicon from 'images/favicon.ico'


const IndexPage = (): React.ReactElement => <html lang="en">
  <head>
    <link rel="icon" type="image/x-icon" href={favicon} />
    <meta charSet="utf-8" />
    <title>Bob Monitoring</title>
    <meta httpEquiv="X-UA-Compatible" content="IE=edge,chrome=1" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      id="viewport" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Bob Monitoring" />
    <meta property="og:description" name="description" content="Monitor all deployments of Bob" />
    <meta property="og:image" content="https://www.bob-emploi.fr/assets/bob-circle-picto.png" />
    <meta property="og:url" content="https://bob-monitoring.s3.eu-west-3.amazonaws.com/" />
  </head>
  <body style={{margin: 0}}>
    <div id="app">Loading…</div>
  </body>
</html>

export default '<!doctype html>' + ReactDOMServer.renderToString(<IndexPage />)

