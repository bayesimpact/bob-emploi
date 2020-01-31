import React from 'react'

import {StaticPage, StrongTitle} from 'components/static'
import {Markdown} from 'components/theme'

import content from './terms/content.txt'


const style = {
  padding: '20px 100px 100px',
}


const TermsAndConditionsPage = (): React.ReactElement => <StaticPage
  page="terms" title={<span>
    Conditions générales d'utilisation<br />
    au <StrongTitle>11 novembre 2016</StrongTitle>
  </span>} style={style}>
  <Markdown content={content} />
</StaticPage>


export default React.memo(TermsAndConditionsPage)
