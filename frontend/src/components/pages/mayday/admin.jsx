import PropTypes from 'prop-types'
import React from 'react'
import ReactDOM from 'react-dom'
import GoogleLogin from 'react-google-login'

import {confirmReviewDonePost} from 'store/api'

import {Button, ExternalLink, Input} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'


class ReviewForm extends React.Component {
  static initialState = {
    customerSupportText: '',
    documentId: '',
    documentOwnerEmail: '',
    documentOwnerName: '',
    isSending: false,
    reviewContent: '',
    reviewerEmail: '',
    wasReviewSent: false,
  }

  static propTypes = {
    fetchGoogleIdToken: PropTypes.func.isRequired,
    googleEmail: PropTypes.string.isRequired,
  }

  state = ReviewForm.initialState

  handleReviewerChange = reviewerEmail => {
    this.setState({reviewerEmail})
    // TODO(pascal): Fetch the names of the owners of the documents that this
    // reviewer has pending and show them in a select.
  }

  confirmReviewDone = event => {
    if (event) {
      event.preventDefault()
    }
    const {customerSupportText, documentId, documentOwnerName,
      reviewContent, reviewerEmail} = this.state
    if (!documentOwnerName && reviewerEmail !== this.props.googleEmail) {
      this.setState({error: 'Prénom du propriétaire du document manquant'})
      return
    }
    if (reviewerEmail === this.props.googleEmail && !documentId) {
      this.setState({error: 'ID du document manquant'})
      return
    }
    if (!reviewerEmail) {
      this.setState({error: 'E-mail du reviewer manquant'})
      return
    }
    this.setState({error: '', isSending: true})
    this.props.fetchGoogleIdToken().
      then(googleIdToken => confirmReviewDonePost(
        reviewerEmail, documentOwnerName, googleIdToken, {
          customerSupportText,
          documentId,
          reviewContent,
        },
      )).
      then(({ownerEmail, wasReviewSent}) => {
        this.setState({
          documentOwnerEmail: ownerEmail || '""',
          error: '',
          isSending: false,
          wasReviewSent,
        })
      }).
      catch(error => {
        this.setState({
          error,
          isSending: false,
          wasReviewSent: false,
        })
      })
  }

  reset = () => {
    this.setState(ReviewForm.initialState)
  }

  render() {
    const {googleEmail} = this.props
    const {customerSupportText, documentId, documentOwnerEmail, documentOwnerName, error, isSending,
      reviewContent, reviewerEmail, wasReviewSent} = this.state
    const errorStyle = {
      color: '#b00',
      fontWidth: 'bold',
      marginTop: 20,
    }
    const emailLabel = <React.Fragment>
      E-mail de la personne qui a relu (mettre <a
        href="#" onClick={() => this.setState({reviewerEmail: googleEmail})}>{googleEmail}</a> si
      c'est vous)
    </React.Fragment>
    const idLabel = <React.Fragment>
      ID du document que vous avez reviewé, à trouver dans la colonne mongo_id
      d'<ExternalLink href="https://airtable.com/tblMtVC42UBEV27Qc/viwbj57QAjt4KyBal">
        airtable
      </ExternalLink>.
    </React.Fragment>
    return <div style={{margin: 'auto', maxWidth: 600}}>
      <h1>Notification de relecture terminée</h1>

      <form onSubmit={this.confirmReviewDone}>
        <FieldSet
          label={emailLabel}>
          <Input type="email" onChange={this.handleReviewerChange} value={reviewerEmail} />
        </FieldSet>

        {googleEmail === reviewerEmail ? null :
          <FieldSet label="Prénom de la personne à qui appartient le document">
            <Input
              onChange={documentOwnerName => this.setState({documentOwnerName})}
              value={documentOwnerName} />
          </FieldSet>}

        {googleEmail === reviewerEmail ? <FieldSet label={idLabel}>
          <Input
            onChange={documentId => this.setState({documentId})}
            value={documentId} />
        </FieldSet> : null}

        <FieldSet label="Commentaires sur le document">
          <textarea
            value={reviewContent} style={{minHeight: 150, width: '100%'}}
            onChange={({target: {value}}) => this.setState({reviewContent: value})} />
        </FieldSet>

        {googleEmail === reviewerEmail ? null : <FieldSet
          label="Un petit mot de la part de &quot;Pascal de Bob&quot; pour la personne qui a relu">
          <textarea
            value={customerSupportText} style={{minHeight: 150, width: '100%'}}
            onChange={({target: {value}}) =>
              this.setState({customerSupportText: value})} />
        </FieldSet>}

        <div style={{textAlign: 'center'}}>
          {documentOwnerEmail ? <React.Fragment>
            {wasReviewSent ? 'Feedback transmis à ' : 'Transmettre la relecture à '}
            <strong>{documentOwnerEmail}</strong>.<br /><br />
            <Button onClick={this.reset}>
              Envoyer une autre notification
            </Button>
          </React.Fragment> : <Button
            onClick={() => this.confirmReviewDone()}
            isProgressShown={isSending} type="validation">
            Confirmer la relecture
          </Button>}
        </div>
        {error ? <div style={errorStyle}>{error}</div> : null}
      </form>
    </div>
  }
}

class AdminPage extends React.Component {

  state = {
    fetchGoogleIdToken: null,
    googleEmail: null,
    hasAuthenticationFailed: false,
  }

  handleGoogleLogin = googleUser => {
    this.setState({
      fetchGoogleIdToken: () => googleUser.reloadAuthResponse().then(({id_token: token}) => token),
      googleEmail: googleUser.getBasicProfile().getEmail(),
    })
  }

  handleGoogleFailure = () => {
    this.setState({hasAuthenticationFailed: true})
  }

  renderLoginForm() {
    return <div style={{padding: 20, textAlign: 'center'}}>
      <GoogleLogin
        clientId={config.googleSSOClientId} offline={false}
        isSignedIn={true}
        onSuccess={this.handleGoogleLogin}
        onFailure={this.handleGoogleFailure} />
      {this.state.hasAuthenticationFailed ? <div style={{margin: 20}}>
        L'authentification a échoué. L'accès à cet outil est restreint.<br />
        Contactez nous : contact@bob-emploi.fr
      </div> : null}
    </div>
  }

  render() {
    const {fetchGoogleIdToken, googleEmail} = this.state
    if (!fetchGoogleIdToken) {
      return this.renderLoginForm()
    }
    return <ReviewForm {...{fetchGoogleIdToken, googleEmail}} />
  }
}

ReactDOM.render(<AdminPage />, document.getElementById('app'))

