import React from 'react'

import {getEmailTemplates} from 'store/advice'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'

import type {CardProps} from './base'
import {EmailTemplate, MethodSuggestionList} from './base'


const MotivationEmail = (props: CardProps): React.ReactElement => {
  const {advice: {adviceId}, handleExplore, t} = props
  // TODO(cyrille): Rather use a wrapper to be defined in base.jsx to avoid calling on adviceId.
  const templates = getEmailTemplates(t)[adviceId] || []
  const title = <Trans parent={null} count={templates.length} t={t}>
    <GrowingNumber number={templates.length} /> exemple de structure d'email
  </Trans>
  return <MethodSuggestionList title={title}>
    {templates.map((template, index): ReactStylableElement => <EmailTemplate
      onContentShown={handleExplore('template')}
      {...template} key={`template-${index}`} />)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(MotivationEmail)


export default {ExpandedAdviceCardContent, pictoName: 'computer' as const}
