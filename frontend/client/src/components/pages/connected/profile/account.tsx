import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, askPasswordReset} from 'store/actions'

import {LoginButton} from 'components/login'
import {Input} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'

import {ProfileUpdater, Step, ProfileStepProps} from './step'


const accountUpdater = new ProfileUpdater({
  email: true,
  lastName: true,
  name: true,
})


interface StepState extends bayes.bob.UserProfile {
  isValidated?: boolean
  passwordResetRequestedEmail?: string
}


// TODO(marielaure): Find a better spot for the reset password link.
// TODO: Fix the padding when viewed mobile on 360x640 - http://screenshot.co/#!/bb84ec39a5
class AccountStepBase
  extends React.PureComponent<ProfileStepProps & {dispatch: DispatchAllActions}, StepState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    hasAccount: PropTypes.bool,
    userYou: PropTypes.func.isRequired,
  }

  public state: StepState = {
    passwordResetRequestedEmail: '',
    ...accountUpdater.getDerivedStateFromProps(this.props)}

  private updater_ = accountUpdater.attachToComponent(this)

  private handleChangePasswordClick = (event): void => {
    const {dispatch} = this.props
    const {email} = this.state
    if (event) {
      event.preventDefault()
    }
    dispatch(askPasswordReset(email)).then((response: {}): {} => {
      if (response) {
        this.setState({passwordResetRequestedEmail: email})
      }
      return response
    })
  }

  public render(): React.ReactNode {
    const {hasAccount, userYou} = this.props
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
          type="text" placeholder="Prénom" autoComplete="first-name"
          onChange={this.updater_.handleChange('name')} value={name} />
      </FieldSet>
      <FieldSet label="Nom" isValid={!!lastName} isValidated={isValidated}>
        <Input
          type="text" placeholder="Nom" autoComplete="family-name"
          onChange={this.updater_.handleChange('lastName')} value={lastName} />
      </FieldSet>
      {hasAccount ? <FieldSet
        label="Email (non éditable pour l'instant)"
        isValid={!!email} isValidated={isValidated}>
        <Input
          type="text" style={{color: colors.COOL_GREY}}
          value={email} readOnly={true} />
      </FieldSet> : <LoginButton
        type="navigation" visualElement="account"
        style={{alignSelf: 'center', marginBottom: 25}}>
        Créer mon compte
      </LoginButton>}
      {hasAccount ? passwordResetRequestedEmail ?
        <span style={changedPasswordMessageStyle}>
          Un email a été envoyé à {passwordResetRequestedEmail}
        </span> : <a
          style={{...changePasswordLinkStyle, cursor: 'pointer'}}
          onClick={this.handleChangePasswordClick}>
          Change{userYou(' ton', 'z votre')} mot de passe
        </a> : null}
    </Step>
  }
}
const AccountStep = connect()(AccountStepBase)


export {AccountStep}
