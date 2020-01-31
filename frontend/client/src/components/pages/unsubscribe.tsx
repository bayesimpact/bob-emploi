import CheckIcon from 'mdi-react/CheckIcon'
import React, {Suspense} from 'react'
import ReactDOM from 'react-dom'
import {WithTranslation, withTranslation} from 'react-i18next'

import {init as i18nInit, localizeOptions} from 'store/i18n'
import {parseQueryString} from 'store/parse'
import {COACHING_EMAILS_OPTIONS} from 'store/user'

import {Trans} from 'components/i18n'
import {Button, SmoothTransitions} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'
import {WaitingPage} from 'components/pages/waiting'
import logoProductImage from 'images/bob-logo.svg'

require('styles/App.css')


interface UnsubscribePageState {
  errorMessage?: string
  isDeleted: boolean
  isDeleting: boolean
  isUpdated: boolean
  isUpdating: boolean
  params: ReturnType<typeof parseQueryString>
}


i18nInit()


class UnsubscribePageBase extends React.PureComponent<WithTranslation, UnsubscribePageState> {
  public state: UnsubscribePageState = {
    isDeleted: false,
    isDeleting: false,
    isUpdated: false,
    isUpdating: false,
    params: window.location.search ? parseQueryString(window.location.search.slice(1)) : {},
  }

  public componentDidUpdate(prevProps: {}, {isUpdated: wasUpdated}: UnsubscribePageState): void {
    const {isUpdated} = this.state
    if (isUpdated && !wasUpdated) {
      clearTimeout(this.timer)
      this.timer = window.setTimeout((): void => this.setState({isUpdated: false}), 5000)
    }
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timer)
  }

  private timer?: number

  private handleCancel(): void {
    window.location.href = '/'
  }

  private handleDelete = (): void => {
    const {t} = this.props
    // TODO(pascal): Drop the use of email after 2018-09-01, until then we need
    // to keep it as the link is used in old emails.
    const {auth = '', email = '', user = ''} = this.state.params || {}
    this.setState({errorMessage: undefined, isDeleting: true})
    fetch('/api/user', {
      body: JSON.stringify({profile: {email}, userId: user}),
      headers: {
        'Authorization': `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
      method: 'delete',
    }).then(this.handleDeletionResponse).catch((): void => {
      this.setState({errorMessage: t('La suppression a échoué'), isDeleting: false})
    })
  }

  private handleDeletionResponse = (response: Response): void => {
    if (response.status >= 400 || response.status < 200) {
      response.text().then((errorMessage: string): void => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P')
        this.setState({
          errorMessage: content.length && (content[0] as HTMLElement).textContent ||
            page.textContent || undefined,
          isDeleting: false,
        })
      })
      return
    }
    this.setState({isDeleted: true, isDeleting: false})
  }

  private handleCoachingEmailFrequencyChange =
  (coachingEmailFrequency: bayes.bob.EmailFrequency): void => {
    const {t} = this.props
    const {params: {auth = '', user = '', coachingEmailFrequency: prevCoachingEmailFrequency}} =
      this.state
    if (prevCoachingEmailFrequency === coachingEmailFrequency) {
      return
    }
    this.setState({
      errorMessage: undefined,
      isUpdating: true,
      params: {...this.state.params, coachingEmailFrequency},
    })

    fetch(`/api/user/${user}/settings`, {
      body: JSON.stringify({coachingEmailFrequency}),
      headers: {
        'Authorization': `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
      method: 'post',
    }).then((response): void => {
      if (response.status >= 400 || response.status < 200) {
        response.text().then((errorMessage: string): void => {
          const page = document.createElement('html')
          page.innerHTML = errorMessage
          const content = page.getElementsByTagName('P')
          this.setState({
            errorMessage: content.length && (content[0] as HTMLElement).textContent ||
              page.textContent || undefined,
            isUpdating: false,
            params: {...this.state.params, coachingEmailFrequency: prevCoachingEmailFrequency},
          })
        })
        return
      }
      this.setState({isUpdated: true, isUpdating: false})
    }).catch((): void => {
      this.setState({errorMessage: t('La mise à jour a échoué'), isUpdating: false})
    })
  }

  private renderHeader(): React.ReactNode {
    const style = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      display: 'flex',
      height: 56,
      justifyContent: 'center',
      width: '100%',
    }
    return <header style={style}>
      <img
        style={{cursor: 'pointer', height: 30}} onClick={this.handleCancel}
        src={logoProductImage} alt={config.productName} />
    </header>
  }

  private renderEmailFrequency(): React.ReactNode {
    const {t} = this.props
    const {errorMessage, isUpdated, isUpdating, params: {coachingEmailFrequency}} = this.state
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
    return <div style={{position: 'relative'}}>
      {t(
        'Quel coaching mail de {{productName}} souhaitez-vous\u00A0?',
        {productName: config.productName},
      )}
      <div style={containerStyle}>
        <Select<bayes.bob.EmailFrequency>
          onChange={this.handleCoachingEmailFrequencyChange}
          value={coachingEmailFrequency as bayes.bob.EmailFrequency}
          placeholder={t('choisissez une option')}
          options={localizeOptions(t, COACHING_EMAILS_OPTIONS)} />
      </div>
      <Trans style={messageStyle(isUpdating)}>Application du changement en cours…</Trans>
      {errorMessage ? <div style={{maxWidth: 340, ...messageStyle(true)}}>
        {errorMessage}
      </div> : null}
      {/* TODO(marielaure): Consider refactoring with profile's save confirmation. */}
      <div style={confirmationPopUpStyle}>
        <div style={checkIconStyle}><CheckIcon size={24} style={{color: '#fff'}} /></div>
        {t('Sauvegardé')}
      </div>
    </div>
  }

  private renderUnsubscribe(): React.ReactNode {
    const {t} = this.props
    const {errorMessage, isDeleting} = this.state
    return <React.Fragment>
      <Trans>
        La desinscription de {{productName: config.productName}} supprimera l'ensemble de vos
        données sur notre site.
        <br />
        <br />
        Voulez-vous vraiment continuer&nbsp;?
      </Trans>
      <div style={{marginTop: 30}}>
        {isDeleting ? null : <Button
          type="back" onClick={this.handleDelete} style={{marginRight: 20}}>
          {t('Oui, je supprime mon compte')}
        </Button>}
        <Button onClick={this.handleCancel} type="validation">
          {t('Non, je garde mon compte')}
        </Button>
        {errorMessage ? <div style={{marginTop: 20}}>
          {errorMessage}
        </div> : null}
      </div>
    </React.Fragment>
  }

  public render(): React.ReactNode {
    const {params: {coachingEmailFrequency}} = this.state
    if (this.state.isDeleted) {
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
      {this.renderHeader()}
      <div style={{flex: 1}} />
      <div style={{maxWidth: 500}}>
        {coachingEmailFrequency ? this.renderEmailFrequency() : this.renderUnsubscribe()}
      </div>

      <div style={{flex: 1}} />
    </div>
  }
}
const UnsubscribePage = withTranslation()(UnsubscribePageBase)


ReactDOM.render(<Suspense fallback={<WaitingPage />}>
  <UnsubscribePage />
</Suspense>, document.getElementById('app'))
