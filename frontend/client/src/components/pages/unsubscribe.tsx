import CheckIcon from 'mdi-react/CheckIcon'
import {parse} from 'query-string'
import React from 'react'
import ReactDOM from 'react-dom'

import {COACHING_EMAILS_OPTIONS} from 'store/user'

import logoProductImage from 'images/logo-bob-beta.svg'

import {Button, SmoothTransitions} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'

require('styles/App.css')


interface UnsubscribePageState {
  errorMessage?: string
  isDeleted: boolean
  isDeleting: boolean
  isUpdated: boolean
  isUpdating: boolean
  params: {
    [paramId: string]: string
  }
}


class UnsubscribePage extends React.PureComponent<{}, UnsubscribePageState> {
  public state: UnsubscribePageState = {
    isDeleted: false,
    isDeleting: false,
    isUpdated: false,
    isUpdating: false,
    params: window.location.search ? parse(window.location.search.slice(1)) : {},
  }

  public componentDidUpdate(prevProps, {isUpdated: wasUpdated}): void {
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
    }).then(this.handleDeletionResponse)
  }

  private handleDeletionResponse = (response): void => {
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

  private handleCoachingEmailFrequencyChange = (coachingEmailFrequency): void => {
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
        style={{cursor: 'pointer', height: 40}} onClick={this.handleCancel}
        src={logoProductImage} alt={config.productName} />
    </header>
  }

  private renderEmailFrequency(): React.ReactNode {
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
    const messageStyle = (status): React.CSSProperties => ({
      marginTop: 15,
      opacity: status ? 1 : 0,
      position: 'absolute',
    })
    return <div style={{position: 'relative'}}>
      Quel coaching mail de {config.productName} souhaitez-vous&nbsp;?
      <div style={containerStyle}>
        <Select<bayes.bob.EmailFrequency>
          onChange={this.handleCoachingEmailFrequencyChange}
          value={coachingEmailFrequency as bayes.bob.EmailFrequency}
          options={COACHING_EMAILS_OPTIONS} />
      </div>
      <div style={messageStyle(isUpdating)}>Application du changement en cours…</div>
      {errorMessage ? <div style={{maxWidth: 340, ...messageStyle(errorMessage)}}>
        {errorMessage}
      </div> : null}
      {/* TODO(marielaure): Consider refactoring with profile's save confirmation. */}
      <div style={confirmationPopUpStyle}>
        <div style={checkIconStyle}><CheckIcon size={24} style={{color: '#fff'}} /></div>
        Sauvegardé
      </div>
    </div>
  }

  private renderUnsubscribe(): React.ReactNode {
    const {errorMessage, isDeleting} = this.state
    return <React.Fragment>
      <div>
        La desinscription de {config.productName} supprimera l'ensemble de vos
        données sur notre site.
        <br />
        <br />
        Voulez-vous vraiment continuer&nbsp;?
      </div>
      <div style={{marginTop: 30}}>
        {isDeleting ? null : <Button
          type="back" onClick={this.handleDelete} style={{marginRight: 20}}>
          Oui, je supprime mon compte
        </Button>}
        <Button onClick={this.handleCancel} type="validation">
          Non, je garde mon compte
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
      return <div>Votre compte a bien été supprimé</div>
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


ReactDOM.render(<UnsubscribePage />, document.getElementById('app'))
