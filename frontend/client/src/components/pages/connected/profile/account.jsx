import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {askPasswordReset} from 'store/actions'

import {Input} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'

import {ProfileUpdater, Step} from './step'


const accountUpdater = new ProfileUpdater({
  email: true,
  lastName: true,
  name: true,
})


// TODO(cyrille): Add tutoiement opt-in/opt-out somewhere.
// TODO(marielaure): Find a better spot for the reset password link.
// TODO: Fix the padding when viewed mobile on 360x640 - http://screenshot.co/#!/bb84ec39a5
class AccountStepBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    passwordResetRequestedEmail: null,
    ...accountUpdater.getDerivedStateFromProps(this.props)}

  updater_ = accountUpdater.attachToComponent(this)

  handleChangePasswordClick = event => {
    const {dispatch} = this.props
    const {email} = this.state
    if (event) {
      event.preventDefault()
    }
    dispatch(askPasswordReset(email)).then(response => {
      if (response) {
        this.setState({passwordResetRequestedEmail: email})
        return response
      }
    })
  }

  render() {
    const {userYou} = this.props
    const {email, isValidated, lastName, name, passwordResetRequestedEmail} = this.state
    const changePasswordLinkStyle = {
      color: colors.BOB_BLUE,
      display: 'inline-block',
      margin: '12px 0px',
      textDecoration: 'underline',
    }
    const changedPasswordMessageStyle = {
      display: 'inline-block',
      margin: '12px 0px',
      textDecoration: 'none',
    }
    return <Step
      title={`${userYou('Tes', 'Vos')} informations`}
      fastForward={this.updater_.handleSubmit}
      onNextButtonClick={this.updater_.handleSubmit}
      {...this.props}>
      <FieldSet label="Prénom" isValid={!!name} isValidated={isValidated}>
        <Input
          type="text" placeholder="Prénom"
          onChange={this.updater_.handleChange('name')} value={name} />
      </FieldSet>
      <FieldSet label="Nom" isValid={!!lastName} isValidated={isValidated}>
        <Input
          type="text" placeholder="Nom"
          onChange={this.updater_.handleChange('lastName')} value={lastName} />
      </FieldSet>
      <FieldSet
        label="Email (non éditable pour l'instant)"
        isValid={!!email} isValidated={isValidated}>
        <Input
          type="text" style={{color: colors.COOL_GREY}}
          value={email} readOnly={true} />
      </FieldSet>
      {passwordResetRequestedEmail ?
        <span style={changedPasswordMessageStyle}>
          Un email a été envoyé à {passwordResetRequestedEmail}
        </span> : <a
          style={{...changePasswordLinkStyle, cursor: 'pointer'}}
          onClick={this.handleChangePasswordClick}>
          Change{userYou(' ton', 'z votre')} mot de passe
        </a>}
    </Step>
  }
}
const AccountStep = connect()(AccountStepBase)


export {AccountStep}
