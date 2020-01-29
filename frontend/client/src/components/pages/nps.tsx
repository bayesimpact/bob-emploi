import ExitToAppIcon from 'mdi-react/ExitToAppIcon'
import React, {Suspense, useCallback, useMemo, useState} from 'react'
import ReactDOM from 'react-dom'
import {useTranslation} from 'react-i18next'

import {init as i18nInit} from 'store/i18n'
import {parseQueryString} from 'store/parse'

import logoProductImage from 'images/bob-logo.svg'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {useModal} from 'components/modal'
import {WaitingPage} from 'components/pages/waiting'
import {ShareModal} from 'components/share'
import {Button, ExternalLink, MIN_CONTENT_PADDING, Textarea} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'

require('styles/App.css')

// TODO(cyrille): Report events to Amplitude.


i18nInit()


interface AckFeedbackProps {
  score: number
  style: React.CSSProperties
}


const AckFeedback = ({score, style}: AckFeedbackProps): React.ReactElement => {
  const containerStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    ...style,
    textAlign: 'center',
  }), [style])
  if (score >= 6) {
    return <Trans style={containerStyle}>
      <p>
        Merci d'avoir pris le temps de nous faire ce retour&nbsp;:
      </p>
      <p>
        c'est très précieux pour nous&nbsp;!
      </p>
    </Trans>
  }
  return <Trans style={containerStyle}>
    <p>
      Merci d'avoir pris le temps de nous faire ce retour&nbsp;!
    </p>
    <p>
      Nous l'étudierons avec soin afin de trouver des façons
      d'améliorer {{productName: config.productName}}.
      Nous tâcherons de faire mieux dans le futur&nbsp;!
    </p>
  </Trans>
}



const NPSShareModalBase = ({isShown}: {isShown: boolean}): React.ReactElement => {
  const {t} = useTranslation()
  return <ShareModal
    isShown={isShown} campaign="nps" visualElement="nps"
    title={t('Merci pour votre retour\u00A0!')}
    intro={<Trans parent={null}>
      Si vous pensez que {{productName: config.productName}} peut aider une personne que vous
      connaissez, n'hésitez pas à lui <strong>partager ce lien</strong>&nbsp;:
    </Trans>}
  >
    <Trans style={{marginBottom: isMobileVersion ? 25 : 40}}>
      Vous pouvez également partager votre avis sur {{productName: config.productName}} en nous
      laissant une note sur l'Emploi Store&nbsp;:
    </Trans>

    <div style={{textAlign: 'center'}}>
      <ExternalLink
        href="http://www.emploi-store.fr/portail/services/bobEmploi"
        style={{textDecoration: 'none'}}>
        <Button type="validation" style={{display: 'flex', margin: 'auto'}}>
          {t("Accéder à l'Emploi Store")}
          <ExitToAppIcon style={{fill: '#fff', height: 19, marginLeft: 10}} />
        </Button>
      </ExternalLink>
    </div>
  </ShareModal>
}
const NPSShareModal = React.memo(NPSShareModalBase)


const combineComments = (comment?: string, action?: string): string|undefined => {
  if (!action) {
    return comment
  }
  return `${comment || ''}${comment ? '\n' : ''}Action décidée :\n${action}`
}


const queryParams = parseQueryString(window.location.search) || {}
const initScore = parseInt(queryParams.score, 10) || 0


function redirectToLandingPage(): void {
  window.location.href = '/'
}


const headerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.BOB_BLUE,
  display: 'flex',
  height: 56,
  justifyContent: 'center',
  width: '100%',
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
}
const textareaStyle: React.CSSProperties = {
  minHeight: 200,
  width: '100%',
}


const NPSFeedbackPage: React.FC = (): React.ReactElement => {
  const [isFormSent, setIsFormSent] = useState(false)
  const [isSendingUpdate, setIsSendingUpdate] = useState(false)
  const [isValidated, setIsValidated] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string|undefined>()
  const [action, setAction] = useState<string|undefined>()
  const [comment, setComment] = useState<string|undefined>()
  const [isShareModalShown, showShareModal] = useModal()
  const {t} = useTranslation()

  const handleUpdateResponse = useCallback((response: Response): void => {
    if (response.status >= 400 || response.status < 200) {
      response.text().then((errorMessage: string): void => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P') as HTMLCollectionOf<HTMLParagraphElement>
        setErrorMessage(
          content.length && content[0].textContent || page.textContent || errorMessage)
        setIsSendingUpdate(false)
      })
      return
    }
    setIsFormSent(true)
    setIsSendingUpdate(false)
    if (!!comment && initScore > 8) {
      showShareModal()
    }
  }, [comment, showShareModal])

  const handleUpdate = useCallback((): void => {
    if (!comment && !action) {
      setIsValidated(true)
      return
    }
    const {token, user} = queryParams
    setErrorMessage(undefined)
    setIsSendingUpdate(true)
    fetch('/api/nps', {
      body: JSON.stringify({
        comment: combineComments(comment, action),
        userId: user,
      }),
      headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
      method: 'post',
    }).then(handleUpdateResponse)
  }, [action, comment, handleUpdateResponse])

  const header = <header style={headerStyle}>
    <img
      style={{cursor: 'pointer', height: 30}} onClick={redirectToLandingPage}
      src={logoProductImage} alt={config.productName} />
  </header>

  const thankYouText = useMemo((): string => {
    if (initScore >= 8) {
      return t('Merci\u00A0! Pouvez-vous en dire plus sur ce qui vous a plu ou aidé\u00A0?')
    }
    if (initScore >= 6) {
      return t(
        'Merci\u00A0! Pouvez-vous en dire plus sur ce qui vous a plu\u00A0? (ou ce que nous ' +
        'pourrions améliorer)',
      )
    }
    return t(
      'Merci\u00A0! Pouvez-vous en dire plus sur ce qui vous a déplu ou ce que nous pourrions ' +
      'améliorer\u00A0?',
    )
  }, [t])

  if (isFormSent && !isShareModalShown) {
    return <AckFeedback style={pageStyle} score={initScore} />
  }
  return <div style={pageStyle}>
    {header}
    <NPSShareModal isShown={isShareModalShown} />
    <div
      style={{flex: 1, maxWidth: 500,
        padding: isMobileVersion ? `0px ${MIN_CONTENT_PADDING}px` : 'initial'}}>
      <div style={{fontSize: 16, margin: '40px 0 0'}}>
        {thankYouText}
      </div>
      <FieldSet
        isValidated={isValidated} isValid={!!comment}>
        <Textarea
          onChange={setComment}
          value={comment} style={textareaStyle} />
      </FieldSet>
      {initScore >= 6 ? <React.Fragment>
        <Trans style={{margin: '0 0 11px'}}>
          Y a-t-il une action en particulier que vous avez décidé d'entreprendre après avoir
          utilisé {{productName: config.productName}}&nbsp;?
        </Trans>
        <Textarea
          onChange={setAction}
          value={action} style={{...textareaStyle, marginBottom: 25}} />
      </React.Fragment> : null}
      <div style={{textAlign: 'center'}}>
        <Button
          onClick={handleUpdate}
          isProgressShown={isSendingUpdate}>
          {t('Envoyer')}
        </Button>
        {errorMessage ? <div style={{marginTop: 20}}>
          {errorMessage}
        </div> : null}
      </div>
    </div>
  </div>
}


ReactDOM.render(<Suspense fallback={<WaitingPage />}>
  <NPSFeedbackPage />
</Suspense>, document.getElementById('app'))
