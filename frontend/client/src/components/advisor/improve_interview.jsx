import PropTypes from 'prop-types'
import React from 'react'

import Picto from 'images/advices/picto-improve-interview.png'

import {ImproveApplicationTips} from './base'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {userYou} = this.props
    return <ImproveApplicationTips
      {...this.props}
      sections={[
        {
          data: 'qualities',
          title: 'Qualités les plus attendues par les recruteurs\u00A0:',
        },
        {
          data: 'preparations',
          title: userYou('Pour préparer ton entretien', 'Pour préparer votre entretien'),
        },
      ]} />
  }
}


export default {ExpandedAdviceCardContent, Picto}
