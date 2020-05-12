import CheckIcon from 'mdi-react/CheckIcon'
import React, {Suspense, useCallback, useEffect, useState} from 'react'
import ReactDOM from 'react-dom'
import {useTranslation} from 'react-i18next'

import {init as i18nInit, localizeOptions} from 'store/i18n'
import {parseQueryString} from 'store/parse'
import {useCancelablePromises} from 'store/promise'
import {COACHING_EMAILS_OPTIONS} from 'store/user'

import {Trans} from 'components/i18n'
import {Button, SmoothTransitions} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'
import {WaitingPage} from 'components/pages/waiting'
import logoProductImage from 'images/bob-logo.svg'

require('styles/App.css')


i18nInit()


const UnsubscribePageBase = (): React.ReactElement => {
  const {t} = useTranslation()
  const [isDeleted, setIsDeleted] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdated, setIsUpdated] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [params] = useState(
    window.location.search ? parseQueryString(window.location.search.slice(1)) : {},
  )
  // TODO(pascal): Drop the use of email after 2018-09-01, until then we need
  // to keep it as the link is used in old emails.
  const {auth = '', email = '', user = ''} = params
  const [coachingEmailFrequency, setCoachingEmailFrequency] =
    useState(params.coachingEmailFrequency as bayes.bob.EmailFrequency|undefined)
  const cancelOnUnmount = useCancelablePromises()

  useEffect((): (() => void) => {
    if (!isUpdated) {
      return (): void => void 0
    }
    const timeout = window.setTimeout((): void => setIsUpdated(false), 5000)
    return (): void => clearTimeout(timeout)
  }, [isUpdated])

  const handleCancel = useCallback((): void => {
    window.location.href = '/'
  }, [])

  const handleDeletionResponse = useCallback((response: Response): void => {
    if (response.status >= 400 || response.status < 200) {
      cancelOnUnmount(response.text()).then((errorMessage: string): void => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P')
        setIsDeleting(false)
        setErrorMessage(
          content.length && (content[0] as HTMLElement).textContent || page.textContent || '',
        )
      })
      return
    }
    setIsDeleting(false)
    setIsDeleted(true)
  }, [cancelOnUnmount])

  const handleDelete = useCallback((): void => {
    setIsDeleting(true)
    setErrorMessage('')
    cancelOnUnmount(fetch('/api/user', {
      body: JSON.stringify({profile: {email}, userId: user}),
      headers: {
        'Authorization': `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
      method: 'delete',
    })).then(handleDeletionResponse).catch((): void => {
      setIsDeleting(false)
      setErrorMessage(t('La suppression a échoué'))
    })
  }, [auth, email, user, cancelOnUnmount, handleDeletionResponse, t])

  const handleCoachingEmailFrequencyChange =
  useCallback((newFrequency: bayes.bob.EmailFrequency): void => {
    if (newFrequency === coachingEmailFrequency) {
      return
    }
    setErrorMessage('')
    setIsUpdating(true)
    setCoachingEmailFrequency(newFrequency)

    cancelOnUnmount(fetch(`/api/user/${user}/settings`, {
      body: JSON.stringify({coachingEmailFrequency: newFrequency}),
      headers: {
        'Authorization': `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
      method: 'post',
    })).then((response): void => {
      if (response.status >= 400 || response.status < 200) {
        response.text().then((errorMessage: string): void => {
          const page = document.createElement('html')
          page.innerHTML = errorMessage
          const content = page.getElementsByTagName('P')
          setIsUpdating(false)
          setCoachingEmailFrequency(coachingEmailFrequency)
          setErrorMessage(
            content.length && (content[0] as HTMLElement).textContent || page.textContent || '',
          )
        })
        return
      }
      setIsUpdated(true)
      setIsUpdating(false)
    }).catch((): void => {
      setIsUpdating(false)
      setErrorMessage(t('La mise à jour a échoué'))
    })
  }, [auth, cancelOnUnmount, coachingEmailFrequency, user, t])

  const headerStyle = {
    alignItems: 'center',
    backgroundColor: colors.BOB_BLUE,
    display: 'flex',
    height: 56,
    justifyContent: 'center',
    width: '100%',
  }
  const header = <header style={headerStyle}>
    <img
      style={{cursor: 'pointer', height: 30}} onClick={handleCancel}
      src={logoProductImage} alt={config.productName} />
  </header>

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 15,
    textAlign: 'left',
    width: 340,
  }
  const confirmationPopUpStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    boxShadow: '0 11px 13px 0 rgba(0, 0, 0, 0.1)',
    display: 'flex',
    padding: '15px 20px',
    position: 'fixed',
    right: 0,
    top: 70,
    transform: `translateX(${isUpdated ? '-10px' : '120%'})`,
    zIndex: 1,
    ...SmoothTransitions,
  }
  const checkIconStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: colors.GREENISH_TEAL,
    borderRadius: '50%',
    display: 'flex',
    height: 30,
    justifyContent: 'center',
    marginRight: 10,
    width: 30,
  }
  const messageStyle = (status?: boolean): React.CSSProperties => ({
    marginTop: 15,
    opacity: status ? 1 : 0,
    position: 'absolute',
  })
  const emailFrequencyPicker = <div style={{position: 'relative'}}>
    {t(
      'Quel coaching mail de {{productName}} souhaitez-vous\u00A0?',
      {productName: config.productName},
    )}
    <div style={containerStyle}>
      <Select<bayes.bob.EmailFrequency>
        onChange={handleCoachingEmailFrequencyChange}
        value={coachingEmailFrequency as bayes.bob.EmailFrequency}
        placeholder={t('choisissez une option')}
        options={localizeOptions(t, COACHING_EMAILS_OPTIONS)} />
    </div>
    <Trans style={messageStyle(isUpdating)}>Application du changement en cours…</Trans>
    {errorMessage ? <div style={{maxWidth: 340, ...messageStyle(true)}}>
      {errorMessage}
    </div> : null}
    {/* TODO(sil): Consider refactoring with profile's save confirmation. */}
    <div style={confirmationPopUpStyle}>
      <div style={checkIconStyle}><CheckIcon size={24} style={{color: '#fff'}} /></div>
      {t('Sauvegardé')}
    </div>
  </div>

  const usnubscribe = <React.Fragment>
    <Trans>
      La desinscription de {{productName: config.productName}} supprimera l'ensemble de vos
      données sur notre site.
      <br />
      <br />
      Voulez-vous vraiment continuer&nbsp;?
    </Trans>
    <div style={{marginTop: 30}}>
      {isDeleting ? null : <Button
        type="back" onClick={handleDelete} style={{marginRight: 20}}>
        {t('Oui, je supprime mon compte')}
      </Button>}
      <Button onClick={handleCancel} type="validation">
        {t('Non, je garde mon compte')}
      </Button>
      {errorMessage ? <div style={{marginTop: 20}}>
        {errorMessage}
      </div> : null}
    </div>
  </React.Fragment>

  if (isDeleted) {
    return <Trans>Votre compte a bien été supprimé</Trans>
  }
  const pageStyle: React.CSSProperties = {
    alignItems: 'center',
    color: colors.DARK_TWO,
    display: 'flex',
    flexDirection: 'column',
    fontSize: 15,
    fontWeight: 500,
    justifyContent: 'center',
    lineHeight: 1.5,
    minHeight: '100vh',
    textAlign: 'center',
  }
  return <div style={pageStyle}>
    {header}
    <div style={{flex: 1}} />
    <div style={{maxWidth: 500}}>
      {coachingEmailFrequency ? emailFrequencyPicker : usnubscribe}
    </div>

    <div style={{flex: 1}} />
  </div>
}
const UnsubscribePage = UnsubscribePageBase


ReactDOM.render(<Suspense fallback={<WaitingPage />}>
  <UnsubscribePage />
</Suspense>, document.getElementById('app'))
