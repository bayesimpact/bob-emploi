import React from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'

import {GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-follow-up.svg'

import {CardProps, EmailTemplate, MethodSuggestionList, TakeAwayTemplate, WithAdvice} from './base'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {advice: {adviceId}, handleExplore, userYou} = this.props
    const templates = getEmailTemplates(userYou)[adviceId] || []
    const title = <React.Fragment>
      <GrowingNumber number={templates.length} /> exemple{templates.length > 1 ? 's ' : ' '}
      d'email de relance
    </React.Fragment>
    return <MethodSuggestionList title={title}>
      {templates.map((template, index: number): ReactStylableElement => <EmailTemplate
        userYou={userYou} onContentShown={handleExplore('email')} isMethodSuggestion={true}
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
