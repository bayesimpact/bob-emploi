import React from 'react'
import {useTranslation} from 'react-i18next'

import {STATIC_NAMESPACE} from 'store/i18n'

import Markdown from 'components/markdown'
import {StaticPage, StrongTitle} from 'components/static'


const style = {
  padding: '20px 100px 100px',
}


const TermsAndConditionsPage = (): React.ReactElement => {
  const [translate] = useTranslation(STATIC_NAMESPACE)
  return <StaticPage
    page="terms" title={<span>
      Conditions générales d'utilisation<br />
      au <StrongTitle>11 novembre 2016</StrongTitle>
    </span>} style={style}>
    <Markdown content={translate('terms')} />
  </StaticPage>
}


export default React.memo(TermsAndConditionsPage)
