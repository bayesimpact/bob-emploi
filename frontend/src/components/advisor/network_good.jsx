import React from 'react'

import {NetworkAdviceCard, NetworkAdvicePage} from './network'


class ExpandedAdviceCardContent extends React.Component {
  render() {
    return <NetworkAdvicePage
      circle={3} {...this.props}
      intro="Vous avez de très bon contacts" />
  }
}


export default {AdviceCard: NetworkAdviceCard, ExpandedAdviceCardContent}
