import React from 'react'
import PropTypes from 'prop-types'

import {YouChooser, tutoyer} from 'store/french'

import {GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-senior.svg'

import {CardProps, MethodSuggestionList, TakeAwayTemplate, WithAdvice} from './base'


const getTips = (isFeminine?: boolean, userYou: YouChooser = tutoyer): React.ReactNode[] => [
  <span key="stable"><strong>Stable</strong>, {userYou('tu en seras', 'vous en serez')} d'autant
    plus fiable.</span>,
  <span key="experiemente">
    <strong>Expérimenté{isFeminine ? 'e' : ''}</strong>,
    {userYou(' tu pourras', ' vous pourrez')} partager avec l'équipe toutes les compétences
    que {userYou('tu as', 'vous avez')} acquises auparavant.
  </span>,
  <span key="operationnel">
    <strong>Opérationnel{isFeminine ? 'le' : ''}</strong>,
    {userYou(' tu seras', ' vous serez')} un plus pour l'équipe tout de suite
    car {userYou('tu sais faire ton', 'vous savez faire votre')} métier.
  </span>,
]


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    profile: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public renderTip(tip, index): ReactStylableElement {
    const trainingNameStyle: React.CSSProperties = {
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    return <div style={trainingNameStyle} key={`tip-${index}`}>
      {tip}
    </div>
  }

  public render(): React.ReactNode {
    const {profile, userYou} = this.props
    const tips = getTips(profile.gender === 'FEMININE', userYou)
    const maybeS = tips.length > 1 ? 's' : ''
    const title = <React.Fragment>
      <GrowingNumber number={tips.length} /> qualité{maybeS} liée{maybeS} à l'âge à mettre en avant
    </React.Fragment>
    return <MethodSuggestionList title={title} isNotClickable={true}>
      {tips.map(this.renderTip)}
    </MethodSuggestionList>
  }
}


class TakeAway extends React.PureComponent<WithAdvice> {
  public render(): React.ReactNode {
    return <TakeAwayTemplate found="atout" list={getTips()} />
  }
}


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
