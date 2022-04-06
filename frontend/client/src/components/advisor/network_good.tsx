import React from 'react'

import type {CardProps} from './base'
import {NetworkAdvicePage, Picto} from './network'


const NetworkGoodCard = (props: CardProps): React.ReactElement => {
  const {t} = props
  return <NetworkAdvicePage
    {...props}
    intro={t(
      "Le réseau, c'est le meilleur canal d'opportunités. C'est grâce aux personnes que vous " +
      'connaissez que vous entendrez parler des gens ou des entreprises qui cherchent des ' +
      'personnes comme vous. Alors allez-y à fond.',
    )} />
}
const ExpandedAdviceCardContent = React.memo(NetworkGoodCard)


export default {ExpandedAdviceCardContent, Picto}
