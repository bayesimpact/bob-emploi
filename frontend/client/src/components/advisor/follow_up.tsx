import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {getEmailTemplates} from 'store/french'

import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-follow-up.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


const makeTitle = (numTemplates: number): React.ReactNode =>
  <React.Fragment>
    <GrowingNumber number={numTemplates} /> exemple{numTemplates > 1 ? 's ' : ' '}
    d'email de relance
  </React.Fragment>

const FollowUpCard: React.FC<CardProps> = (props): React.ReactElement => {
  const {advice: {adviceId}, handleExplore} = props
  const {t} = useTranslation()
  const templates = useMemo(() => getEmailTemplates(t)[adviceId], [adviceId, t]) || []
  const title = useMemo(() => makeTitle(templates.length), [templates])
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
