import PropTypes from 'prop-types'
import React from 'react'

import content from './privacy/content.txt'

import {StaticPage, StrongTitle} from 'components/static'
import {Markdown} from 'components/theme'

class PrivacyPage extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
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

export {PrivacyPage}
