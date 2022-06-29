import React from 'react'
import {useTranslation} from 'react-i18next'

import loadingImageFr from 'images/logo-bob-loading-fr.svg'
// TODO(émilie): Vectorize the text to avoid font bug on Chrome for MacOS.
import loadingImageEn from 'images/logo-bob-loading-en.svg'

const LoadingImage = (): React.ReactElement => {
  const {i18n, t} = useTranslation('translation', {useSuspense: false})
  return <img alt={t('Chargement…')}
    src={(i18n.language?.startsWith('en') ? loadingImageEn : loadingImageFr)} />
}

export default React.memo(LoadingImage)
