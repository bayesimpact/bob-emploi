import React from 'react'

import Picto from 'images/advices/picto-specific-to-job.svg'

import {CardProps, StaticAdviceCardContent} from './base'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public render(): React.ReactNode {
    const {advice} = this.props
    return <StaticAdviceCardContent {...advice} />
  }
}


export default {ExpandedAdviceCardContent, Picto}
