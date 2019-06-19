import PropTypes from 'prop-types'
import React from 'react'

import {CardProps} from './base'
import {NetworkAdvicePage, NewPicto, TakeAway} from './network'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    return <NetworkAdvicePage
      {...this.props}
      intro={`${this.props.userYou("N'aie", "N'ayez")} pas peur du mot. "Faire du réseau"
      c'est tout bête : dire ce qu'on cherche à ses amis, rencontrer des gens. Le monde est petit,
      il s'agit simplement d'en profiter.`} />
  }
}


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
