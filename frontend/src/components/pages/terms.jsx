import React from 'react'

import {StaticPage, StrongTitle} from 'components/static'
import {Markdown} from 'components/theme'

class TermsAndConditionsPage extends React.Component {
  render() {
    return <StaticPage page="terms" title={<span>
      Conditions générales d'utilisation<br />
      au <StrongTitle>11 novembre 2016</StrongTitle>
    </span>} style={{display: 'flex'}}>
      <Markdown content={require('./terms/content.txt')} />
    </StaticPage>
  }
}

export {TermsAndConditionsPage}
