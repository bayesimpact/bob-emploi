import PropTypes from 'prop-types'
import React from 'react'
import {Trans, TransProps, useTranslation} from 'react-i18next'


// Fix bugs of the Trans component.
// TODO(pascal): Get rid of this once https://github.com/i18next/react-i18next/issues/1011
// and https://github.com/i18next/react-i18next/issues/1014 are solved.
const TransFunc: React.FC<TransProps & React.HTMLProps<Element>> = (props):
React.ReactElement => {
  const {t} = useTranslation()
  // i18next-extract-disable-next-line
  return <Trans t={t} defaults={props.i18nKey} {...props} />
}
TransFunc.propTypes = {
  i18nKey: PropTypes.string,
}


export {TransFunc as Trans}
