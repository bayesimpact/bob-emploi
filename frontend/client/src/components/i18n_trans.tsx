import React from 'react'
import type {TFuncKey, TransProps} from 'react-i18next'
import {Trans, useTranslation} from 'react-i18next'


// Fix bugs of the Trans component.
// TODO(pascal): Get rid of this once https://github.com/i18next/react-i18next/issues/1014 are
// solved.
const TransFunc = <
  K extends TFuncKey extends infer A ? A : never
>(props: TransProps<K, 'translation'|'landing'|'components'>): React.ReactElement => {
  const {t} = useTranslation(props.ns)
  // i18next-extract-disable-next-line
  return <Trans t={t} defaults={props.i18nKey as string|undefined} {...props} />
}


export default TransFunc
