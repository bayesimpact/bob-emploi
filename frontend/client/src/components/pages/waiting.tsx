import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import LoadingImage from 'deployment/loading_image'


const baseStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#fff',
  boxSizing: 'border-box',
  display: 'flex',
  height: '100%',
  justifyContent: 'center',
  position: 'fixed',
  width: '100vw',
}

interface Props {
  loadingImage?: string
  style?: React.CSSProperties
}
const WaitingPage: React.FC<Props> = ({loadingImage, style}): React.ReactElement => {
  const {t} = useTranslation('translation', {useSuspense: false})
  const finalStyle = useMemo((): React.CSSProperties => ({
    ...baseStyle,
    ...style,
  }), [style])
  return <div style={finalStyle}>
    {loadingImage ? <img alt={t('Chargement…')} src={loadingImage} /> : <LoadingImage />}
  </div>
}


export default React.memo(WaitingPage)
