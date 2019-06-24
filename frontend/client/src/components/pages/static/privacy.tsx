import React from 'react'

import {isMobileVersion} from 'components/mobile'
import {StaticPage, StrongTitle} from 'components/static'
import {Markdown} from 'components/theme'

import content from './privacy/content.txt'


export default class PrivacyPage extends React.PureComponent {
  public render(): React.ReactNode {
    const style = {
      fontSize: 16,
      lineHeight: 1.69,
      padding: isMobileVersion ? 20 : '84px 100px',
    }
    return <StaticPage page="privacy" title={<span>
      Vie <StrongTitle>privée</StrongTitle>
    </span>} style={style}>
      <Markdown content={content} />
    </StaticPage>
  }
}
