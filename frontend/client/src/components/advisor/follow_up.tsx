import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {getEmailTemplates} from 'store/french'

import {Trans} from 'components/i18n'
import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-follow-up.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


const FollowUpCard: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {advice: {adviceId}, handleExplore, t} = props
  const templates = useMemo(() => getEmailTemplates(t)[adviceId], [adviceId, t]) || []
  const numTemplates = templates.length
  const title = <Trans parent={null} count={numTemplates} t={t}>
    <GrowingNumber number={numTemplates} /> exemple d'email de relance
  </Trans>
  return <MethodSuggestionList title={title}>
    {templates.map((template, index: number): ReactStylableElement => <EmailTemplate
      onContentShown={handleExplore('email')} isMethodSuggestion={true}
      {...template} key={`template-${index}`} />)}
  </MethodSuggestionList>
}
FollowUpCard.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(FollowUpCard)

export default {ExpandedAdviceCardContent, Picto}
