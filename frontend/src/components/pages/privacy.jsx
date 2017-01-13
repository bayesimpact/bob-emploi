import React from 'react'

import {StaticPage, StrongTitle} from 'components/static'
import {Markdown} from 'components/theme'

class PrivacyPage extends React.Component {
  render() {
    const style = {
      fontSize: 16,
      lineHeight: 1.69,
      padding: '84px 100px',
    }
    return <StaticPage page="privacy" title={<span>
      Vie <StrongTitle>privée</StrongTitle>
    </span>} style={style}>
      <Markdown content={require('./privacy/content.txt')} />
    </StaticPage>
  }
}

export {PrivacyPage}
