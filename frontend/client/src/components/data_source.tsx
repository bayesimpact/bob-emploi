import React from 'react'
import {useTranslation} from 'react-i18next'

import {PADDED_ON_MOBILE} from 'components/theme'


interface Props {
  children: React.ReactNode
  isStarShown?: boolean
  style?: React.CSSProperties
}

const DataSource = (props: Props): React.ReactElement => {
  const {children, isStarShown = true, style} = props
  const sourceStyle = {
    color: colors.COOL_GREY,
    fontSize: 13,
    fontStyle: 'italic',
    margin: '15px 0',
    padding: PADDED_ON_MOBILE,
    ...style,
  }
  const {t} = useTranslation('components')
  return <p style={sourceStyle}>
    {isStarShown ? '*' : ''}{t('Source\u00A0:')} {children}
  </p>
}


export default React.memo(DataSource)
