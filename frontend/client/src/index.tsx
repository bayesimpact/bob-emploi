import type {TFunction} from 'i18next'
import React from 'react'
import ReactDOMServer from 'react-dom/server'

import i18nInit from 'store/static_i18n?static'

import favicon from 'deployment/favicon.ico'
import WaitingPage from 'components/pages/waiting'


// TODO(cyrille): DRY with upskilling_index.
const Template = ({t}: {t: TFunction}): React.ReactElement => {
  const description = t(
    "{{productName}} fait un bilan sur votre recherche d'emploi et vous donne les meilleurs " +
    "conseils. 100% gratuit, rapide et fait par l'ONG Bayes Impact",
    {productName: config.productName},
  )
  return <html lang={config.defaultLang.replace('_', '-').replace(/-UK$/, '-GB')}>
    <head>
      <link rel="icon" type="image/x-icon" href={favicon} />
      <meta charSet="utf-8" />
      <title>{config.productName}</title>
      <meta httpEquiv="X-UA-Compatible" content="IE=edge,chrome=1" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={config.productName} />
      <meta property="og:description" name="description" content={description} />
      <meta property="og:image" content={`${config.canonicalUrl}/assets/bob-circle-picto.png`} />
      <meta property="og:url" content={config.canonicalUrl} />
      {config.facebookSSOAppId ?
        <meta property="fb:app_id" content={config.facebookSSOAppId} /> : null}
      <meta property="version" content={config.clientVersion} />
    </head>
    <body style={{margin: 0}}>
      <div id="app"><WaitingPage /></div>
      <div id="modals" />
    </body>
  </html>
}

export default async (): Promise<string> =>
  '<!doctype html>' + ReactDOMServer.renderToString(<Template t={await i18nInit()} />)

