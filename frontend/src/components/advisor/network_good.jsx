import React from 'react'

import {NetworkAdviceCard, NetworkAdvicePage} from './network'


class AdvicePageContent extends React.Component {
  render() {
    return <NetworkAdvicePage
        circle={3} {...this.props}
        intro="Vous avez de très bon contacts" />
  }
}


export default {AdvicePageContent, FullAdviceCard: NetworkAdviceCard}
