import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'


const AlphaTag = (props: {style?: React.CSSProperties}): React.ReactElement => {
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.RED_PINK,
    borderRadius: 5,
    color: '#fff',
    padding: 5,
    ...props.style,
  }), [props.style])
  const {t} = useTranslation()
  return <div
    style={containerStyle}
    title={t("Ce conseil n'est donné qu'aux utilisateurs de la version alpha")}>
    α
  </div>
}


export default React.memo(AlphaTag)
