import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {useSafeDispatch} from 'store/promise'

import Button from 'components/button'
import type {Inputable} from 'components/input'
import Input from 'components/input'

import type {DispatchAllEvalActions} from '../store/actions'
import {exportFeedback} from '../store/actions'

const aMonthAgo = new Date(Date.now() - 1000 * 3600 * 24 * 30)

const pageStyle: React.CSSProperties = {
  padding: 20,
}

const afterDateStyle: React.CSSProperties = {
  marginBottom: '1em',
  maxWidth: 400,
}

const errorStyle: React.CSSProperties = {
  color: colors.RED_PINK,
  fontWeight: 'bold',
}

const inputStyle: React.CSSProperties = {
  backgroundColor: '#fff',
}

function parseDate(date: string): string|undefined {
  try {
    return new Date(date).toISOString()
  } catch {
    return undefined
  }
}

const FeedbackPage = (): React.ReactElement => {
  const {t} = useTranslation()
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const [afterDate, setAfterDate] = useState(aMonthAgo.toISOString().slice(0, 'YYYY-MM-DD'.length))
  const [afterDateError, setAfterDateError] = useState('')

  const afterDateRef = useRef<Inputable>(null)

  const exportLatest = useCallback(() => {
    if (!afterDate) {
      setAfterDateError(t('Une date de début est requise, par exemple\u00A0: 2022-03-22.'))
      afterDateRef.current?.focus()
      return
    }
    const afterDateIso = parseDate(afterDate)
    if (!afterDateIso || afterDate !== afterDateIso.slice(0, 'YYYY-MM-DD'.length)) {
      setAfterDateError(t('Format de date incorrect\u00A0: AAAA-MM-JJ.'))
      afterDateRef.current?.focus()
      return
    }
    setAfterDateError('')
    dispatch(exportFeedback({
      after: afterDateIso,
    }))
  }, [afterDate, dispatch, t])

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault()
    exportLatest()
  }, [exportLatest])

  const afterDateInputId = useMemo(_uniqueId, [])
  const afterDateErrorId = useMemo(_uniqueId, [])

  return <main role="main" style={pageStyle}>
    <h1>{t('Exporter les retours des utilisateurs')}</h1>

    <form onSubmit={handleSubmit}>
      <div style={afterDateStyle}>
        <label htmlFor={afterDateInputId}>{t('À partir du\u00A0:')}</label>
        <Input
          value={afterDate} ref={afterDateRef}
          onChange={setAfterDate} id={afterDateInputId} style={inputStyle}
          name="start date" aria-describedby={afterDateError ? afterDateErrorId : undefined} />
        {afterDateError ? <p id={afterDateErrorId} style={errorStyle}>
          {afterDateError}
        </p> : null}
      </div>

      <Button onClick={exportLatest}>
        {t('Exporter en CSV')}
      </Button>
    </form>
  </main>
}

export default React.memo(FeedbackPage)
