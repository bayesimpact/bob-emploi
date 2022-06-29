import type {TOptions} from 'i18next'
import React, {useMemo} from 'react'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'

import type {CardProps} from './base'
import {MethodSuggestionList} from './base'


interface SeniorTipProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

const TipBase: React.FC<SeniorTipProps> =
  ({children, style}: SeniorTipProps): ReactStylableElement => {
    const trainingNameStyle = useMemo((): React.CSSProperties => ({
      ...style,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }), [style])
    return <div style={trainingNameStyle}>
      {children}
    </div>
  }
const Tip = React.memo(TipBase)


const SeniorMethod: React.FC<CardProps> =
  (props: CardProps): React.ReactElement => {
    const {profile, t} = props
    const tOptions = useMemo((): TOptions => ({
      context: profile.gender,
    }), [profile.gender])
    const title = <Trans parent={null} t={t}>
      <GrowingNumber number={3} /> qualités liées à l'âge à mettre en avant
    </Trans>
    return <MethodSuggestionList title={title} isNotClickable={true}>
      <Trans parent={Tip} t={t} tOptions={tOptions}>
        <strong>Stable</strong>, vous en serez d'autant plus fiable.
      </Trans>
      <Trans parent={Tip} t={t} tOptions={tOptions}>
        <strong>Expérimenté·e</strong>, vous pourrez partager avec l'équipe toutes les compétences
        que vous avez acquises auparavant.
      </Trans>
      <Trans parent={Tip} t={t} tOptions={tOptions}>
        <strong>Opérationnel·le</strong>, vous serez un plus pour l'équipe tout de suite
        car vous savez faire votre métier.
      </Trans>
    </MethodSuggestionList>
  }
const ExpandedAdviceCardContent = React.memo(SeniorMethod)

export default {ExpandedAdviceCardContent, pictoName: 'thumbsUpGreen' as const}
