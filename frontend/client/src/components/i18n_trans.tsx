import PropTypes from 'prop-types'
import React from 'react'
import {Namespace, TFuncKey, Trans, TransProps, useTranslation} from 'react-i18next'


// Fix bugs of the Trans component.
// TODO(pascal): Get rid of this once https://github.com/i18next/react-i18next/issues/1014 are
// solved.
const TransFunc = <
  K extends TFuncKey<N> extends infer A ? A : never,
  N extends Namespace = 'translation',
  E extends Element = HTMLDivElement
>(props: TransProps<K, N, E>): React.ReactElement => {
  const {t} = useTranslation<N>()
  // i18next-extract-disable-next-line
  return <Trans t={t} defaults={props.i18nKey as string|undefined} {...props} />
}
TransFunc.propTypes = {
  i18nKey: PropTypes.string,
}


export default TransFunc
