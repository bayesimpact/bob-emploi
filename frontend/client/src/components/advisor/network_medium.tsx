import PropTypes from 'prop-types'
import React from 'react'

import {CardProps} from './base'
import {NetworkAdvicePage, Picto} from './network'


const NetworkMediumCard = (props: CardProps): React.ReactElement => {
  const {t} = props
  return <NetworkAdvicePage
    {...props}
    intro={t(
      'N\'ayez pas peur du mot. "Faire du réseau" c\'est tout bête\u00A0: dire ce qu\'on cherche ' +
      "à ses amis, rencontrer des gens. Le monde est petit il s'agit simplement d'en profiter.",
    )} />
}
NetworkMediumCard.propTypes = {
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(NetworkMediumCard)


export default {ExpandedAdviceCardContent, Picto}
