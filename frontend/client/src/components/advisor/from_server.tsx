import React from 'react'

import type {CardProps} from './base'
import {StaticAdviceCardContent} from './base'


const AdviceFromServer = ({advice}: CardProps): React.ReactElement =>
  <StaticAdviceCardContent {...advice} />
const ExpandedAdviceCardContent = React.memo(AdviceFromServer)


export default {ExpandedAdviceCardContent, pictoName: 'gear' as const}
