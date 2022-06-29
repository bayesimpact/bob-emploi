import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {RadiumLink} from 'components/radium'

interface Props {
  style?: RadiumCSSProperties
}

const focusOnMain = () => {
  document.getElementById('main')?.focus()
}

const appearingOnFocusStyle: RadiumCSSProperties = {
  ':focus': {
    height: 'initial',
    padding: 10,
  },
  'display': 'block',
  'height': 0,
  'overflow': 'hidden',
}

const SkipToContent = ({style}: Props): React.ReactElement => {
  const {t} = useTranslation('components')
  const containerStyle = useMemo((): RadiumCSSProperties => ({
    ...appearingOnFocusStyle,
    ...style,
    ':focus': {
      ...appearingOnFocusStyle[':focus'],
      ...style?.[':focus'],
    },
  }), [style])
  return <nav role="navigation">
    <RadiumLink style={containerStyle} to="#main" onClick={focusOnMain}>
      {t('Aller au contenu')}
    </RadiumLink>
  </nav>
}

export default React.memo(SkipToContent)
