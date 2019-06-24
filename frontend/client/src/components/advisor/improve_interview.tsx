import PropTypes from 'prop-types'
import React from 'react'

import NewPicto from 'images/advices/picto-improve-interview.svg'

import {CardProps, ImproveApplicationTips} from './base'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
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


export default {ExpandedAdviceCardContent, NewPicto}
