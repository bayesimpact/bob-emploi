import React from 'react'

import Picto from 'images/advices/picto-specific-to-job.svg'

import type {CardProps} from './base'
import {StaticAdviceCardContent} from './base'


const AdviceFromServer = ({advice}: CardProps): React.ReactElement =>
  <StaticAdviceCardContent {...advice} />
const ExpandedAdviceCardContent = React.memo(AdviceFromServer)


export default {ExpandedAdviceCardContent, Picto}
