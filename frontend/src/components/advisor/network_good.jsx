import PropTypes from 'prop-types'
import React from 'react'


import {NetworkAdviceCard, NetworkAdvicePage, Picto} from './network'

class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {userYou} = this.props
    return <NetworkAdvicePage
      circle={3} {...this.props}
      intro={`Le réseau, c'est le meilleur canal d'opportunités. C'est grâce aux
    personnes que
    ${userYou('tu connais que tu entendras', 'vous connaissez que vous entendrez')}
    parler des gens ou des entreprises qui cherchent des personnes comme
    ${userYou(' toi. Alors vas-y', ' vous. Alors allez-y')} à fond.`} />
  }
}


export default {AdviceCard: NetworkAdviceCard, ExpandedAdviceCardContent, Picto}
