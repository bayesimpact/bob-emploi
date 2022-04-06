import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {SmoothTransitions} from 'components/theme'

interface Props {
  id?: string
  score: number
  style?: React.CSSProperties
}

const PasswordStrength = (props: Props): React.ReactElement => {
  const {id, score, style = {margin: '5px 0 0'}} = props
  const {t} = useTranslation('components')
  const progressStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: score < 40 ? colors.RED_PINK :
      score < 60 ? colors.DARK_YELLOW :
        score < 80 ? colors.SUN_YELLOW_80 : colors.LIME_GREEN,
    display: 'block',
    height: 3,
    width: `${score}%`,
    ...SmoothTransitions,
  }), [score])
  return <p style={style} role="status" id={id}>
    <span style={progressStyle} />
    <span style={{display: 'block', marginTop: 3}}>{
      score < 40 ? t('Mot de passe trop faible') :
        score < 60 ? t('Mot de passe faible') :
          score < 80 ? t('Mot de passe moyen') : t('Mot de passe sécurisé')
    }</span>
  </p>
}

export default React.memo(PasswordStrength)
