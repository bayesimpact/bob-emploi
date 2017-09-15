import React from 'react'
import ReactDOM from 'react-dom'
import _ from 'underscore'

import config from 'config'

import logoBobEmploiBetaImage from 'images/logo-bob-emploi-beta.svg'

import {Button, Colors} from 'components/theme'

require('styles/App.css')


class UnsubscribePage extends React.Component {
  state = {
    errorMessage: null,
    isDeleted: false,
    isDeleting: false,
    params: {},
  }

  componentWillMount() {
    const {search} = window.location
    if (search) {
      const params = _.object(
        search.slice(1).split('&').map(keyValue => {
          const parts = keyValue.split('=')
          if (parts.length !== 2) {
            return {}
          }
          return [
            decodeURIComponent(parts[0]),
            decodeURIComponent(parts[1]),
          ]
        }),
      )
      this.setState({params})
    }
  }

  handleCancel() {
    window.location.href = '/'
  }

  handleDelete = () => {
    const {auth, email} = this.state.params || {}
    this.setState({errorMessage: null, isDeleting: true})
    fetch('/api/user', {
      body: JSON.stringify({
        profile: {email: email || ''},
      }),
      headers: {
        'Authorization': `Bearer ${auth || ''}`,
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

  renderHeader() {
    const style = {
      alignItems: 'center',
      backgroundColor: Colors.DARK,
      display: 'flex',
      height: 56,
      justifyContent: 'center',
      width: '100%',
    }
    return <header style={style}>
      <img
        style={{cursor: 'pointer'}} onClick={this.handleCancel}
        src={logoBobEmploiBetaImage} alt={config.productName} />
    </header>
  }

  render() {
    const {errorMessage, isDeleted, isDeleting} = this.state
    if (isDeleted) {
      return <div>Votre compte a bien été supprimé</div>
    }
    const pageStyle = {
      alignItems: 'center',
      color: Colors.DARK_TWO,
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

      <div style={{flex: 1}} />
    </div>
  }
}


ReactDOM.render(<UnsubscribePage />, document.getElementById('app'))
