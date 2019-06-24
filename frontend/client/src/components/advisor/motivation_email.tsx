import React from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'

import {GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-motivation-email.svg'

import {CardProps, EmailTemplate, MethodSuggestionList, TakeAwayTemplate, WithAdvice} from './base'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {advice: {adviceId}, handleExplore, userYou} = this.props
    // TODO(cyrille): Rather use a wrapper to be defined in base.jsx to avoid calling on adviceId.
    const templates = getEmailTemplates(userYou)[adviceId] || []
    const maybeS = templates.length <= 1 ? '' : 's'
    const title = <React.Fragment>
      <GrowingNumber number={templates.length} /> exemple{maybeS} de structure{maybeS} d'email
    </React.Fragment>
    return <MethodSuggestionList title={title}>
      {templates.map((template, index): ReactStylableElement => <EmailTemplate
        userYou={userYou} onContentShown={handleExplore('template')} isMethodSuggestion={true}
        {...template} key={`template-${index}`} />)}
    </MethodSuggestionList>
  }
}


class TakeAway extends React.PureComponent<WithAdvice> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
  }

  public render(): React.ReactNode {
    const {advice: {adviceId}} = this.props
    return <TakeAwayTemplate found="modèle" list={getEmailTemplates()[adviceId]} />
  }
}


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
