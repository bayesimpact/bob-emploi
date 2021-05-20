import PropTypes from 'prop-types'
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
  const {t} = useTranslation()
  return <div style={sourceStyle}>
    {isStarShown ? '*' : ''}{t('Source\u00A0:')} {children}
  </div>
}
DataSource.propTypes = {
  children: PropTypes.node,
  isStarShown: PropTypes.bool,
  style: PropTypes.object,
}


export default React.memo(DataSource)
