import i18n from 'i18next'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import loadingImageFr from 'images/logo-bob-loading-fr.svg'
// TODO(émilie): Vectorize the text to avoid font bug on Chrome for MacOS.
import loadingImageEn from 'images/logo-bob-loading-en.svg'


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
    <img alt={t('Chargement…')}
      src={loadingImage || (i18n.language?.startsWith('en') ? loadingImageEn : loadingImageFr)} />
  </div>
}
WaitingPage.propTypes = {
  loadingImage: PropTypes.string,
  style: PropTypes.object,
}


export default React.memo(WaitingPage)
