import PropTypes from 'prop-types'
import React from 'react'

import {CardProps} from './base'
import {NetworkAdvicePage, Picto} from './network'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {userYou} = this.props
    return <NetworkAdvicePage
      {...this.props}
      intro={`Le réseau, c'est le meilleur canal d'opportunités. C'est grâce aux
    personnes que
    ${userYou('tu connais que tu entendras', 'vous connaissez que vous entendrez')}
    parler des gens ou des entreprises qui cherchent des personnes comme
    ${userYou(' toi. Alors vas-y', ' vous. Alors allez-y')} à fond.`} />
  }
}


export default {ExpandedAdviceCardContent, Picto}
