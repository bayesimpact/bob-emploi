import * as Sentry from '@sentry/browser'
import _memoize from 'lodash/memoize'
import React from 'react'
import {useTranslation} from 'react-i18next'


interface Props {
  children: (React.ReactElement|string)[]|React.ReactElement|string
  lastSeparator?: React.ReactNode
  separator?: React.ReactNode
}


const extractSeparator = _memoize((listString: string): readonly [string, string] => {
  const parts = listString.split(/<\d><\/\d>/)
  if (parts.length !== 4) {
    Sentry.captureMessage?.(`Separators could not be identified in: ${listString}.`)
    return [', ', ' ou ']
  }
  return parts.slice(1, 2) as [string, string]
})


const StringJoiner = (props: Props): React.ReactElement => {
  const {t} = useTranslation('components')
  const [defaultSeparator, defaultLastSeparator] =
    extractSeparator(t('<0></0>, <1></1> ou <2></2>'))
  const {children, lastSeparator = defaultLastSeparator, separator = defaultSeparator} = props
  const parts: React.ReactNode[] = []
  const numChildren = React.Children.count(children)
  React.Children.forEach(children, (child: React.ReactElement|string, index: number): void => {
    if (index) {
      const nextSeparator = (index === numChildren - 1) ? lastSeparator : separator
      parts.push(<span key={`sep-${index}`}>{nextSeparator}</span>)
    }
    parts.push(child)
  })
  return <span>{parts}</span>
}


export default React.memo(StringJoiner)
