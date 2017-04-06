import React from 'react'

import {NetworkAdviceCard, NetworkAdvicePage} from './network'


class AdvicePageContent extends React.Component {
  render() {
    return <NetworkAdvicePage
        circle={1} {...this.props}
        intro="Vous nous avez dit avoir peu de contacts" />
  }
}


export default {AdvicePageContent, FullAdviceCard: NetworkAdviceCard}
