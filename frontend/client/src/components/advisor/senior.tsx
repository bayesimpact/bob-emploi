import React from 'react'
import PropTypes from 'prop-types'

import {YouChooser, tutoyer} from 'store/french'

import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-senior.svg'

import {CardProps, MethodSuggestionList} from './base'


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


interface SeniorTipProps {
  style?: React.CSSProperties
  tip: React.ReactNode
}

const TipBase: React.FC<SeniorTipProps> =
  ({tip, style}: SeniorTipProps): ReactStylableElement => {
    const trainingNameStyle: React.CSSProperties = {
      ...style,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    return <div style={trainingNameStyle}>
      {tip}
    </div>
  }
TipBase.propTypes = {
  style: PropTypes.object,
  tip: PropTypes.node.isRequired,
}
const Tip = React.memo(TipBase)

const ExpandedAdviceCardContentBase: React.FC<CardProps> =
  (props: CardProps): React.ReactElement => {
    const {profile, userYou} = props
    const tips = getTips(profile.gender === 'FEMININE', userYou)
    const maybeS = tips.length > 1 ? 's' : ''
    const title = <React.Fragment>
      <GrowingNumber number={tips.length} /> qualité{maybeS} liée{maybeS} à l'âge à mettre en avant
    </React.Fragment>
    return <MethodSuggestionList title={title} isNotClickable={true}>
      {tips.map((tip, index): ReactStylableElement => <Tip key={`tip-${index}`} tip={tip} />)}
    </MethodSuggestionList>
  }
ExpandedAdviceCardContentBase.propTypes = {
  profile: PropTypes.object.isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ExpandedAdviceCardContentBase)

export default {ExpandedAdviceCardContent, Picto}
