import PropTypes from 'prop-types'
import React from 'react'

import {getEmailTemplates} from 'store/french'

import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-motivation-email.svg'

import {CardProps, EmailTemplate, MethodSuggestionList} from './base'


class MotivationEmail extends React.PureComponent<CardProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {advice: {adviceId}, handleExplore, t} = this.props
    // TODO(cyrille): Rather use a wrapper to be defined in base.jsx to avoid calling on adviceId.
    const templates = getEmailTemplates(t)[adviceId] || []
    const maybeS = templates.length <= 1 ? '' : 's'
    const title = <React.Fragment>
      <GrowingNumber number={templates.length} /> exemple{maybeS} de structure{maybeS} d'email
    </React.Fragment>
    return <MethodSuggestionList title={title}>
      {templates.map((template, index): ReactStylableElement => <EmailTemplate
        onContentShown={handleExplore('template')} isMethodSuggestion={true}
        {...template} key={`template-${index}`} />)}
    </MethodSuggestionList>
  }
}


export default {ExpandedAdviceCardContent: MotivationEmail, Picto}
