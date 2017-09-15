import PropTypes from 'prop-types'
import React from 'react'

import {createEvalUseCasePost} from 'store/api'
import {validateEmail} from 'store/validations'

import {Modal} from 'components/modal'
import {Button, FieldSet, Input, SmoothTransitions} from 'components/theme'


class CreatePoolModal extends React.Component {
  static propTypes = {
    googleIdToken: PropTypes.string.isRequired,
  }

  state = {
    email: '',
    emailSaved: false,
    poolName: '',
    useCaseIdCreated: null,
  }

  handleCreate = () => {
    const {googleIdToken} = this.props
    const {email, poolName} = this.state
    if (!poolName || !validateEmail(email)) {
      return
    }
    createEvalUseCasePost(poolName, email, googleIdToken).
      then(({useCaseId}) => this.setState({
        email: '',
        emailSaved: email,
        useCaseIdCreated: useCaseId,
      }))
    this.emailInput && this.emailInput.focus()
  }

  render() {
    const {email, emailSaved, poolName, useCaseIdCreated} = this.state
    return <Modal
      {...this.props} title="Créer un pool" style={{padding: '0 50px 40px', width: 550}}>
      <FieldSet label="Nom du pool" style={{marginTop: 30}}>
        <Input
          placeholder="Saisir le nom du pool"
          value={poolName} onChange={poolName => this.setState({emailSaved: false, poolName})} />
      </FieldSet>
      <FieldSet label="Adresse email d'un utilisateur">
        <Input
          placeholder="Ajouter une adresse" ref={dom => {
            this.emailInput = dom
          }}
          value={email} onChange={email => this.setState({email, emailSaved: false})} />
        <div style={{opacity: emailSaved ? 1 : 0, ...SmoothTransitions}}>
          Utilisateur <strong>{emailSaved}</strong> ajouté
          en tant que <strong>{useCaseIdCreated}</strong>
        </div>
      </FieldSet>

      <div style={{textAlign: 'center'}}>
        <Button
          type="validation" disabled={!poolName || !validateEmail(email)}
          onClick={this.handleCreate}>
          Ajouter
        </Button>
      </div>
    </Modal>
  }
}


export {CreatePoolModal}
