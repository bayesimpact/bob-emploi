import React from 'react'
import {useTranslation} from 'react-i18next'

import InformationIcon from 'components/information_icon'

interface Props {
  'aria-describedby'?: string
  children?: React.ReactNode
}

export const Content = (props: Props): React.ReactElement => {
  const {children} = props
  const {t} = useTranslation('components')
  return <React.Fragment>
    {t(
      "Votre réponse n'affectera pas les conseils de {{productName}}.",
      {productName: config.productName},
    )} {children || t(
      "Cette information est utilisée pour l'évaluation d'impact qui nous permet de comprendre " +
      'nos utilisateurs et comment nous pouvons vous aider au mieux.',
    )}
  </React.Fragment>
}

const SameAdviceTooltip = ({children, ...otherProps}: Props): React.ReactElement => {
  return <InformationIcon {...otherProps} tooltipWidth={220}>
    <Content>{children}</Content>
  </InformationIcon>
}

export default React.memo(SameAdviceTooltip)
