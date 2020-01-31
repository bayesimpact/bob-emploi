import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {StaticPage, StrongTitle} from 'components/static'
import {Markdown} from 'components/theme'

import content from './privacy/content.txt'


const style = {
  fontSize: 16,
  lineHeight: 1.69,
  padding: isMobileVersion ? 20 : '84px 100px',
}


const PrivacyPage: React.FC = (): React.ReactElement => <StaticPage
  page="privacy" title={<span>
      Vie <StrongTitle>privée</StrongTitle>
  </span>} style={style}>
  <Markdown content={content} />
</StaticPage>


export default React.memo(PrivacyPage)
