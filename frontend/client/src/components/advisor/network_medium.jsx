import PropTypes from 'prop-types'
import React from 'react'


import {NetworkAdvicePage, Picto} from './network'

class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  render() {
    return <NetworkAdvicePage
      circle={2} {...this.props}
      intro={`${this.props.userYou("N'aie", "N'ayez")} pas peur du mot.
      "Faire du réseau" c'est tout bête : dire ce qu'on cherche à ses amis, rencontrer des gens.
      Le monde est petit, il s'agit simplement d'en profiter.`}
    />
  }
}


export default {ExpandedAdviceCardContent, Picto}
