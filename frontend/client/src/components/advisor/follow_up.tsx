import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {getEmailTemplates} from 'store/i18n'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-follow-up.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


const FollowUpCard: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {advice: {adviceId}, handleExplore, t} = props
  const templates = useMemo(() => getEmailTemplates(t)[adviceId], [adviceId, t]) || []
  const numTemplates = templates.length
  const title = <Trans parent={null} count={numTemplates} t={t}>
    <GrowingNumber number={numTemplates} /> exemple d'email de relance
  </Trans>
  return <React.Fragment>
    <Trans style={{marginBottom: 15}} t={t}>
      Lorsqu'un recruteur ne répond pas, cela ne veut pas dire que votre candidature n'est pas de
      qualité. C'est souvent par manque de temps, ou parce que le recruteur ne croit pas avoir de
      poste à vous proposer (il s'agit de le convaincre&nbsp;!).
    </Trans>
    <MethodSuggestionList title={title}>
      {templates.map((template, index: number): ReactStylableElement => <EmailTemplate
        onContentShown={handleExplore('email')}
        {...template} key={`template-${index}`} />)}
    </MethodSuggestionList>
  </React.Fragment>
}
FollowUpCard.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(FollowUpCard)

export default {ExpandedAdviceCardContent, Picto}
