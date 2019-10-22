import _memoize from 'lodash/memoize'
import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState} from 'store/actions'

import {LoginButton} from 'components/login'
import {AccountDeletionModal} from 'components/logout'
import {RadiumDiv} from 'components/radium'
import {IconInput, Input} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'

import {ProfileUpdater, Step, ProfileStepProps} from './step'


const accountUpdater = new ProfileUpdater({
  email: false,
  lastName: false,
  name: true,
})


interface StepState {
  isAccountDeletionModalShown?: boolean
  isPasswordChanged?: boolean
  isResetPasswordModalShown?: boolean
  isValidated?: boolean
  passwordResetRequestedEmail?: string
}


interface ConnectedStepProps {
  hasPassword: boolean
}


interface StepProps extends ProfileStepProps, ConnectedStepProps {
  dispatch: DispatchAllActions
}


class AccountStepBase
  extends React.PureComponent<StepProps, StepState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    hasAccount: PropTypes.bool,
    hasPassword: PropTypes.bool,
    profile: PropTypes.shape({
      email: PropTypes.string,
      lastName: PropTypes.string,
      name: PropTypes.string,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public state: StepState = {
    isAccountDeletionModalShown: false,
  }

  private updater_ = accountUpdater.attachToComponent(this)

  private handleShowAccountDeletionModal = _memoize(
    (isAccountDeletionModalShown: boolean): (() => void) =>
      (): void => this.setState({isAccountDeletionModalShown}))

  public render(): React.ReactNode {
    const {hasAccount, profile: {email, lastName, name}, userYou} = this.props
    const {isAccountDeletionModalShown, isValidated} = this.state
    const deleteContainerStyle: RadiumCSSProperties = {
      ':hover': {color: colors.DARK_TWO},
      alignSelf: 'start',
      color: colors.COOL_GREY,
      cursor: 'pointer',
      fontSize: 15,
      padding: 0,
    }
    // TODO(marielaure): Make AccountDeletionModal and deletion "button" functional.
    return <Step
      title={`${userYou('Tes', 'Vos')} informations`}
      fastForward={this.updater_.handleSubmit}
      onNextButtonClick={this.updater_.handleSubmit}
      {...this.props}>
      <AccountDeletionModal
        isShown={isAccountDeletionModalShown}
        onClose={this.handleShowAccountDeletionModal(false)} />
      <FieldSet label="Prénom" isValid={!!name} isValidated={isValidated}>
        <Input
          type="text" placeholder="Prénom" autoComplete="first-name"
          onChange={this.updater_.handleChange('name')} value={name || ''}
          onChangeDelayMillisecs={1000} />
      </FieldSet>
      <FieldSet label="Nom" isValid={!!lastName} isValidated={isValidated}>
        <Input
          type="text" placeholder="Nom" autoComplete="family-name"
          onChange={this.updater_.handleChange('lastName')} value={lastName || ''}
          onChangeDelayMillisecs={1000} />
      </FieldSet>
      {hasAccount ? <FieldSet label="Email" isValid={!!email} isValidated={isValidated}>
        <IconInput
          type="text" style={{color: colors.COOL_GREY}} iconComponent={LockOutlineIcon}
          value={email} readOnly={true} />
      </FieldSet> : <LoginButton
        type="navigation" visualElement="account"
        style={{alignSelf: 'center', marginBottom: 25}}>
        Créer mon compte
      </LoginButton>}
      <RadiumDiv
        style={deleteContainerStyle}
        onClick={this.handleShowAccountDeletionModal(true)}>
          Supprimer {hasAccount ? 'mon compte' : 'mes données'}
      </RadiumDiv>
    </Step>
  }
}
const AccountStep = connect(
  ({user: {hasPassword}}: RootState): ConnectedStepProps => ({hasPassword: !!hasPassword})
)(AccountStepBase)


export {AccountStep}
