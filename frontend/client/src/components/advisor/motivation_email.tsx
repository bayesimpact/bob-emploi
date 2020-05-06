import PropTypes from 'prop-types'
import React from 'react'

import {getEmailTemplates} from 'store/french'

import {Trans} from 'components/i18n'
import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-motivation-email.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


const MotivationEmail = (props: CardProps): React.ReactElement => {
  const {advice: {adviceId}, handleExplore, t} = props
  // TODO(cyrille): Rather use a wrapper to be defined in base.jsx to avoid calling on adviceId.
  const templates = getEmailTemplates(t)[adviceId] || []
  const title = <Trans parent={null} count={templates.length} t={t}>
    <GrowingNumber number={templates.length} /> exemple de structure d'email
  </Trans>
  return <MethodSuggestionList title={title}>
    {templates.map((template, index): ReactStylableElement => <EmailTemplate
      onContentShown={handleExplore('template')} isMethodSuggestion={true}
      {...template} key={`template-${index}`} />)}
  </MethodSuggestionList>
}
MotivationEmail.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(MotivationEmail)


export default {ExpandedAdviceCardContent, Picto}
