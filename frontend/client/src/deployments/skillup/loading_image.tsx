import React from 'react'
import {useTranslation} from 'react-i18next'

import loadingImage from './loading_image.svg'

const LoadingImage = (): React.ReactElement => {
  const {t} = useTranslation('translation', {useSuspense: false})
  return <img alt={t('Chargement…')} src={loadingImage} />
}

export default React.memo(LoadingImage)
