import {parse} from 'query-string'
import React from 'react'
import ReactDOM from 'react-dom'

import {COACHING_EMAILS_OPTIONS} from 'store/user'

import logoProductImage from 'images/logo-bob-beta.svg'

import {Button} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'

require('styles/App.css')


class UnsubscribePage extends React.Component {
  state = {
    errorMessage: null,
    isDeleted: false,
    isDeleting: false,
    params: window.location.search ? parse(window.location.search.slice(1)) : {},
  }

  handleCancel() {
    window.location.href = '/'
  }

  handleDelete = () => {
    // TODO(pascal): Drop the use of email after 2018-09-01, until then we need
    // to keep it as the link is used in old emails.
    const {auth = '', email = '', user = ''} = this.state.params || {}
    this.setState({errorMessage: null, isDeleting: true})
    fetch('/api/user', {
      body: JSON.stringify({profile: {email}, userId: user}),
      headers: {
        'Authorization': `Bearer ${auth}`,
        'Content-Type': 'application/json',
      },
      method: 'delete',
    }).then(this.handleDeletionResponse)
  }

  handleDeletionResponse = response => {
    if (response.status >= 400 || response.status < 200) {
      response.text().then(errorMessage => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P')
        this.setState({
          errorMessage: content.length && content[0].innerText || page.innerText,
          isDeleting: false,
        })
      })
      return
    }
    this.setState({isDeleted: true, isDeleting: false})
  }

  handleCoachingEmailFrequencyChange = coachingEmailFrequency => {
    const {params: {auth = '', user = '', coachingEmailFrequency: prevCoachingEmailFrequency}} =
      this.state
    if (prevCoachingEmailFrequency === coachingEmailFrequency) {
      return
    }
    this.setState({
      errorMessage: '',
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
    }).then(response => {
      if (response.status >= 400 || response.status < 200) {
        response.text().then(errorMessage => {
          const page = document.createElement('html')
          page.innerHTML = errorMessage
          const content = page.getElementsByTagName('P')
          this.setState({
            errorMessage: content.length && content[0].innerText || page.innerText,
            isUpdating: false,
            params: {...this.state.params, coachingEmailFrequency: prevCoachingEmailFrequency},
          })
        })
        return
      }
      this.setState({isUpdating: false})
    })
  }

  renderHeader() {
    const style = {
      alignItems: 'center',
      backgroundColor: colors.DARK,
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

  renderEmailFrequency() {
    const {errorMessage, isUpdating, params: {coachingEmailFrequency}} = this.state
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      marginTop: 15,
      textAlign: 'left',
      width: 340,
    }
    return <div>
      Activer le coaching mail de {config.productName}&nbsp;?
      <div style={containerStyle}>
        <Select
          onChange={this.handleCoachingEmailFrequencyChange}
          value={coachingEmailFrequency}
          options={COACHING_EMAILS_OPTIONS} />
      </div>
      {isUpdating ? <div style={{marginTop: 15}}>Application du changement en cours…</div> : null}
      {errorMessage ? <div style={{marginTop: 15, maxWidth: 340}}>
        {errorMessage}
      </div> : null}
    </div>
  }

  renderUnsubscribe() {
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

  render() {
    const {params: {coachingEmailFrequency}} = this.state
    if (this.state.isDeleted) {
      return <div>Votre compte a bien été supprimé</div>
    }
    const pageStyle = {
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
