import React, {useMemo} from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'

import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-follow-up.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


const makeTitle = (numTemplates): React.ReactNode =>
  <React.Fragment>
    <GrowingNumber number={numTemplates} /> exemple{numTemplates > 1 ? 's ' : ' '}
    d'email de relance
  </React.Fragment>

const FollowUpCard: React.FC<CardProps> = (props): React.ReactElement => {
  const {advice: {adviceId}, handleExplore, userYou} = props
  const templates = useMemo(() => getEmailTemplates(userYou)[adviceId], [adviceId, userYou]) || []
  const title = useMemo(() => makeTitle(templates.length), [templates])
  return <MethodSuggestionList title={title}>
    {templates.map((template, index: number): ReactStylableElement => <EmailTemplate
      userYou={userYou} onContentShown={handleExplore('email')} isMethodSuggestion={true}
      {...template} key={`template-${index}`} />)}
  </MethodSuggestionList>
}
FollowUpCard.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(FollowUpCard)

export default {ExpandedAdviceCardContent, Picto}
