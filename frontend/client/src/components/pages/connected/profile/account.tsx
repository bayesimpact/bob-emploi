import i18n from 'i18next'
import _memoize from 'lodash/memoize'
import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState} from 'store/actions'
import {isTuPossible, localizeOptions, prepareT} from 'store/i18n'
import {GENDER_OPTIONS, FAMILY_SITUATION_OPTIONS} from 'store/user'

import {LoginButton} from 'components/login'
import {AccountDeletionModal} from 'components/logout'
import {RadiumDiv} from 'components/radium'
import {IconInput, Input, RadioGroup} from 'components/theme'
import {BirthYearSelector, FieldSet, Select} from 'components/pages/connected/form_utils'

import {ProfileUpdater, Step, ProfileStepProps} from './step'


const accountUpdater = new ProfileUpdater({
  canTutoie: false,
  email: false,
  gender: false,
  lastName: false,
  name: true,
  yearOfBirth: false,
})


const yesNoOptions = [
  {name: prepareT('oui'), value: true},
  {name: prepareT('non'), value: false},
] as const


const languageOptions = [
  {name: prepareT('français'), value: 'fr'},
  {name: prepareT('anglais (expérimental)'), value: 'en'},
] as const


const radioGroupStyle = {
  display: 'flex',
  justifyContent: 'space-around',
}

interface StepState {
  isAccountDeletionModalShown?: boolean
  isPasswordChanged?: boolean
  isResetPasswordModalShown?: boolean
  isValidated?: boolean
  name: string
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
    isShownAsStepsDuringOnboarding: PropTypes.bool,
    profile: PropTypes.shape({
      email: PropTypes.string,
      lastName: PropTypes.string,
      name: PropTypes.string,
    }).isRequired,
    t: PropTypes.func.isRequired,
  }

  public state: StepState = {
    isAccountDeletionModalShown: false,
    name: this.props.profile.name || '',
  }

  private updater_ = accountUpdater.attachToComponent(this)

  private handleShowAccountDeletionModal = _memoize(
    (isAccountDeletionModalShown: boolean): (() => void) =>
      (): void => this.setState({isAccountDeletionModalShown}))

  private handleNameUpdate = (name: string): void => {
    this.setState({name})
    const cleanName = name.trim()
    if (cleanName) {
      this.updater_.handleChange('name')(cleanName)
    }
  }

  private updateLanguage = (language: string): void => {
    const {profile: {canTutoie}} = this.props
    const locale = language + (isTuPossible(language) && canTutoie ? '@tu' : '')
    this.updater_.handleChange('locale')(locale)
  }

  public render(): React.ReactNode {
    const {
      hasAccount,
      isShownAsStepsDuringOnboarding,
      profile: {canTutoie, email, familySituation, gender, lastName, locale, yearOfBirth},
      t,
    } = this.props
    const {isAccountDeletionModalShown, isValidated, name} = this.state
    const isValidName = !!name.trim()
    const deleteContainerStyle: RadiumCSSProperties = {
      ':hover': {color: colors.DARK_TWO},
      'alignSelf': 'start',
      'color': colors.COOL_GREY,
      'cursor': 'pointer',
      'fontSize': 15,
      'padding': 0,
    }
    // TODO(pascal): Add a way to change the user's locale.
    const language = locale || i18n.language
    // TODO(marielaure): Make AccountDeletionModal and deletion "button" functional.
    return <Step
      title={t('Vos informations')}
      fastForward={this.updater_.handleSubmit}
      onNextButtonClick={this.updater_.handleSubmit}
      {...this.props}>
      <AccountDeletionModal
        isShown={isAccountDeletionModalShown}
        onClose={this.handleShowAccountDeletionModal(false)} />
      <FieldSet label={t('Prénom')} isValid={isValidName} isValidated={isValidated || !isValidName}>
        <Input
          type="text" placeholder={t('Prénom')} autoComplete="first-name"
          onChange={this.handleNameUpdate} value={name}
          onChangeDelayMillisecs={1000} />
      </FieldSet>
      <FieldSet label={t('Nom')} isValid={!!lastName} isValidated={isValidated}>
        <Input
          type="text" placeholder={t('Nom')} autoComplete="family-name"
          onChange={this.updater_.handleChange('lastName')} value={lastName || ''}
          onChangeDelayMillisecs={1000} />
      </FieldSet>
      {hasAccount ? <FieldSet label={t('Email')} isValid={!!email} isValidated={isValidated}>
        <IconInput
          type="text" style={{color: colors.COOL_GREY}} iconComponent={LockOutlineIcon}
          value={email} readOnly={true} />
      </FieldSet> : <LoginButton
        type="navigation" visualElement="account"
        style={{alignSelf: 'center', marginBottom: 25}}>
        Créer mon compte
      </LoginButton>}
      {isShownAsStepsDuringOnboarding ? null : <React.Fragment>
        <FieldSet
          label={t('Vous êtes\u00A0:')}
          isValid={!!gender} isValidated={isValidated}>
          <RadioGroup
            style={radioGroupStyle}
            onChange={this.updater_.handleChange('gender')}
            options={localizeOptions(t, GENDER_OPTIONS)} value={gender} />
        </FieldSet>
        <FieldSet
          label={t('La langue de {{productName}}\u00A0:', {productName: config.productName})}>
          <Select
            onChange={this.updateLanguage}
            value={language.replace(/@.*$/, '')}
            options={localizeOptions(t, languageOptions)} />
        </FieldSet>
        {isTuPossible(language) ? <FieldSet
          label="Tutoiement"
          isValid={true} isValidated={isValidated}>
          <RadioGroup
            style={radioGroupStyle}
            onChange={this.updater_.handleChange('canTutoie')}
            options={localizeOptions(t, yesNoOptions)} value={!!canTutoie} />
        </FieldSet> : null}
        <FieldSet
          label={t('Année de naissance')}
          isValid={!!yearOfBirth} isValidated={isValidated}>
          <BirthYearSelector
            onChange={this.updater_.handleChange('yearOfBirth')}
            placeholder={t('choisissez une année')}
            value={yearOfBirth} />
        </FieldSet>
        <FieldSet
          label={t('Situation familiale')}
          isValid={!!familySituation}>
          <Select
            onChange={this.updater_.handleChange('familySituation')}
            options={localizeOptions(t, FAMILY_SITUATION_OPTIONS, {context: gender})}
            placeholder={t('choisissez une situation')}
            value={familySituation} />
        </FieldSet>
      </React.Fragment>}
      <RadiumDiv
        style={deleteContainerStyle}
        onClick={this.handleShowAccountDeletionModal(true)}>
        {hasAccount ? t('Supprimer mon compte') : t('Supprimer mes données')}
      </RadiumDiv>
    </Step>
  }
}
const AccountStep = connect(
  ({user: {hasPassword}}: RootState): ConnectedStepProps => ({hasPassword: !!hasPassword}),
)(AccountStepBase)


export {AccountStep}
