import {TFunction} from 'i18next'
import React from 'react'
import ReactDOMServer from 'react-dom/server'

import {init as i18nInit} from 'store/i18n'

import WaitingPage from './components/pages/waiting'
import favicon from './images/favicon.ico'

const Template = ({t}: {t: TFunction}): React.ReactElement => {
  const description = t(
    'Découvrez les meilleures carrières dans votre département avec {{productName}}.',
    {productName: config.productName},
  )
  return <html lang={config.defaultLang.replace('_', '-').replace(/-UK$/, '-GB')}>
    <head>
      <link rel="icon" type="image/x-icon" href={favicon} />
      <meta charSet="utf-8" />
      <title>{config.productName}</title>
      <meta httpEquiv="X-UA-Compatible" content="IE=edge,chrome=1" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        id="viewport" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={config.productName} />
      <meta property="og:description" name="description" content={description} />
      <meta
        property="og:image" content={`${config.canonicalUrl}/assets/jobflix-circle-picto.png`} />
      <meta property="og:url" content={config.canonicalUrl} />
      {config.facebookSSOAppId ?
        <meta property="fb:app_id" content={config.facebookSSOAppId} /> : null}
      <meta property="version" content={config.clientVersion} />
    </head>
    <body style={{margin: 0}}>
      <div id="app"><WaitingPage /></div>
    </body>
  </html>
}


async function renderTemplate(): Promise<string> {
  const t = await i18nInit({isStatic: true})
  return '<!doctype html>' + ReactDOMServer.renderToString(<Template t={t} />)
}


export default renderTemplate
