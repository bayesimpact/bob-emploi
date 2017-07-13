import React from 'react'

import {NetworkAdviceCard, NetworkAdvicePage} from './network'


class ExpandedAdviceCardContent extends React.Component {
  render() {
    return <NetworkAdvicePage
      circle={1} {...this.props}
      intro="Vous nous avez dit avoir peu de contacts" />
  }
}


export default {AdviceCard: NetworkAdviceCard, ExpandedAdviceCardContent}
