import PropTypes from 'prop-types'
import React from 'react'

import Picto from 'images/advices/picto-resume.png'

import {ImproveApplicationTips} from './base'


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const props = this.props
    return <ImproveApplicationTips
      {...props}
      sections={[
        {
          data: 'qualities',
          title: 'Qualités les plus attendues par les recruteurs\u00A0:',
        },
        {
          data: 'improvements',
          title: `Pour améliorer ${props.userYou('ta', 'votre')} candidature`,
        },
      ]}
    />
  }
}


export default {ExpandedAdviceCardContent, Picto}
