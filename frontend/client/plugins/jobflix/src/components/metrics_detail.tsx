import React, {useMemo} from 'react'

import isMobileVersion from 'store/mobile'

interface Props {
  children?: React.ReactNode
  style?: React.CSSProperties
}
const MetricsDetail = ({children, style}: Props): React.ReactElement => {
  const metricsStyle = useMemo((): React.CSSProperties => ({
    ...style,
    padding: 16,
    textAlign: 'center',
    width: '32%',
    ...isMobileVersion && {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 8,
      minWidth: 245,
      padding: '16px 25px',
    },
  }), [style])
  return <li style={metricsStyle}>
    {children}
  </li>
}
export default React.memo(MetricsDetail)
