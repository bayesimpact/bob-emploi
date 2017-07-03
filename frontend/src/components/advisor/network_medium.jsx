import React from 'react'

import {NetworkAdviceCard, NetworkAdvicePage} from './network'


class ExpandedAdviceCardContent extends React.Component {
  render() {
    return <NetworkAdvicePage
      circle={2} {...this.props}
      intro="Vous nous avez dit connaitre quelques personnes" />
  }
}


export default {AdviceCard: NetworkAdviceCard, ExpandedAdviceCardContent}
