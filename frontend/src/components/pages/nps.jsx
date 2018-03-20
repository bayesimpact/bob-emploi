import ExitToAppIcon from 'mdi-react/ExitToAppIcon'
import PropTypes from 'prop-types'
import {parse} from 'query-string'
import React from 'react'
import ReactDOM from 'react-dom'

import config from 'config'

import {isOnSmallScreen} from 'store/mobile'

import logoProductImage from 'images/logo-bob-beta.svg'

import {ShareModal} from 'components/share'
import {Button, Colors, FieldSet} from 'components/theme'

require('styles/App.css')

// TODO(cyrille): Report events to Amplitude.


class NPSFeedbackPage extends React.Component {
  static childContextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    errorMessage: null,
    isFormSent: false,
    isMobileVersion: isOnSmallScreen(),
    isSendingUpdate: false,
    isShareModalShown: false,
    isValidated: false,
    params: {},
    score: 0,
  }

  getChildContext() {
    const {isMobileVersion} = this.state
    return {isMobileVersion}
  }

  componentWillMount() {
    const {search} = window.location
    const params = parse(search)
    this.setState({
      params,
      score: parseInt(params.score, 10) || 0,
    })
  }

  handleCancel() {
    window.location.href = '/'
  }

  handleUpdate = () => {
    const {comment, params} = this.state
    if (!comment) {
      this.setState({isValidated: true})
      return
    }
    const {token, user} = params || {}
    this.setState({errorMessage: null, isSendingUpdate: true})
    fetch('/api/nps', {
      body: JSON.stringify({comment, userId: user}),
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      method: 'post',
    }).then(this.handleUpdateResponse)
  }

  handleUpdateResponse = response => {
    if (response.status >= 400 || response.status < 200) {
      response.text().then(errorMessage => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P')
        this.setState({
          errorMessage: content.length && content[0].innerText || page.innerText,
          isSendingUpdate: false,
        })
      })
      return
    }
    this.setState(({comment, score}) => ({
      isFormSent: true,
      isSendingUpdate: false,
      isShareModalShown: comment && score > 8,
    }))
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
        style={{cursor: 'pointer', height: 40}} onClick={this.handleCancel}
        src={logoProductImage} alt={config.productName} />
    </header>
  }

  renderThankYouText() {
    const prefix = 'Merci ! Pouvez-vous en dire plus sur ce qui vous a '
    const {score} = this.state
    if (score >= 8) {
      return prefix + 'plu ou aidé ?'
    }
    if (score >= 6) {
      return prefix + 'plu ? (ou ce que nous pourrions améliorer)'
    }
    return prefix + 'déplu ou ce que nous pourrions améliorer ?'
  }

  renderAckFeedback(pageStyle) {
    const containerStyle = {
      ...pageStyle,
      textAlign: 'center',
    }
    const {score} = this.state
    if (score >= 6) {
      return <div style={containerStyle}>
        <p>
          Merci d'avoir pris le temps de nous faire ce retour&nbsp;:
        </p>
        <p>
          c'est très précieux pour nous&nbsp;!
        </p>
      </div>
    }
    return <div style={containerStyle}>
      <p>
        Merci d'avoir pris le temps de nous faire ce retour&nbsp;!
      </p>
      <p>
        Nous l'étudierons avec soin afin de trouver des façons d'améliorer {config.productName}.
        Nous tâcherons de faire mieux dans le futur !
      </p>
    </div>
  }

  renderShareModal() {
    const {isMobileVersion, isShareModalShown} = this.state
    return <ShareModal
      isShown={isShareModalShown} campaign="nps" visualElement="nps"
      title="Merci pour votre retour&nbsp;!"
      intro={<React.Fragment>
        Si vous pensez que {config.productName} peut aider une personne que vous
        connaissez, n'hésitez pas à lui <strong>partager ce lien</strong>&nbsp;:
      </React.Fragment>}
    >
      <div style={{marginBottom: isMobileVersion ? 25 : 40}}>
        Vous pouvez également partager votre avis sur {config.productName} en nous laissant une
        note sur l'Emploi Store&nbsp;:
      </div>

      <div style={{textAlign: 'center'}}>
        {/* TODO(pascal): Make that an "a" link so that hovering shows the URL in
          the browser's status bar. */}
        <Button
          type="validation" style={{display: 'flex', margin: 'auto'}}
          onClick={() => window.open(
            'http://www.emploi-store.fr/portail/services/bobEmploi', '_blank',
          )}>
          Accéder à l'Emploi Store
          <ExitToAppIcon fill="#fff" style={{height: 19, marginLeft: 10}} />
        </Button>
      </div>
    </ShareModal>
  }

  render() {
    const {comment, errorMessage, isFormSent, isSendingUpdate, isShareModalShown,
      isValidated} = this.state
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
    }
    if (isFormSent && !isShareModalShown) {
      return this.renderAckFeedback(pageStyle)
    }
    const textareaStyle = {
      minHeight: 200,
      width: '100%',
    }
    return <div style={pageStyle}>
      {this.renderHeader()}
      {this.renderShareModal()}
      <div style={{flex: 1, maxWidth: 500}}>
        <div style={{fontSize: 16, margin: '40px 0 20px'}}>
          {this.renderThankYouText()}
        </div>
        <FieldSet
          isValidated={isValidated} isValid={!!comment}>
          <textarea
            onChange={event => this.setState({comment: event.target.value})}
            value={comment} style={textareaStyle} />
        </FieldSet>
        <div style={{textAlign: 'center'}}>
          <Button
            onClick={this.handleUpdate}
            isProgressShown={isSendingUpdate}>
            Envoyer
          </Button>
          {errorMessage ? <div style={{marginTop: 20}}>
            {errorMessage}
          </div> : null}
        </div>
      </div>
    </div>
  }
}


ReactDOM.render(<NPSFeedbackPage />, document.getElementById('app'))
