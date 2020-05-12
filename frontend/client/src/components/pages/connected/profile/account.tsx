import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useState} from 'react'

import {getLanguage, getLocaleWithTu, isTuPossible, localizeOptions, prepareT} from 'store/i18n'
import {GENDER_OPTIONS, FAMILY_SITUATION_OPTIONS} from 'store/user'

import {LoginButton} from 'components/login'
import {AccountDeletionModal} from 'components/logout'
import {useModal} from 'components/modal'
import {RadiumDiv} from 'components/radium'
import {IconInput, Input, RadioGroup} from 'components/theme'
import {BirthYearSelector, FieldSet, Select} from 'components/pages/connected/form_utils'

import {Step, ProfileStepProps, useProfileChangeCallback, useProfileUpdater} from './step'


const fieldsRequired = {
  email: false,
  gender: false,
  lastName: false,
  locale: false,
  name: true,
  yearOfBirth: false,
}


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

const deleteContainerStyle: RadiumCSSProperties = {
  ':hover': {color: colors.DARK_TWO},
  'alignSelf': 'start',
  'color': colors.COOL_GREY,
  'cursor': 'pointer',
  'fontSize': 15,
  'padding': 0,
}


const AccountStepBase: React.FC<ProfileStepProps> = (props): React.ReactElement => {
  const {hasAccount, isShownAsStepsDuringOnboarding, profile, onChange, onSubmit, t} = props
  const {email, familySituation, gender, lastName, locale, name: nameProp, yearOfBirth} = profile
  const [isAccountDeletionModalShown, showDeletionModal, hideDeletionModal] = useModal(false)

  const {handleSubmit, isValidated} = useProfileUpdater(fieldsRequired, profile, onSubmit)
  const updateFamilySituation = useProfileChangeCallback('familySituation', profile, onChange)
  const updateGender = useProfileChangeCallback('gender', profile, onChange)
  const updateLastName = useProfileChangeCallback('lastName', profile, onChange)
  const updateLocale = useProfileChangeCallback('locale', profile, onChange)
  const updateName = useProfileChangeCallback('name', profile, onChange)
  const updateYearOfBirth = useProfileChangeCallback('yearOfBirth', profile, onChange)

  const [name, setDirtyName] = useState(nameProp || '')
  const cleanName = name.trim()
  const setName = useCallback((name: string): void => {
    setDirtyName(name)
    if (cleanName) {
      updateName(cleanName)
    }
  }, [cleanName, updateName])

  const language = getLanguage(locale)
  const canTutoie = !!locale?.endsWith('@tu')
  const updateLanguage = useCallback(
    (language: string): void => updateLocale(getLocaleWithTu(language, canTutoie)),
    [canTutoie, updateLocale],
  )
  const updateCanTutoie = useCallback(
    (canTutoie: boolean): void => updateLocale(getLocaleWithTu(language, canTutoie)),
    [language, updateLocale],
  )
  // TODO(sil): Make AccountDeletionModal and deletion "button" functional.
  return <Step
    title={t('Vos informations')} fastForward={handleSubmit}
    onNextButtonClick={handleSubmit} {...props}>
    <AccountDeletionModal isShown={isAccountDeletionModalShown} onClose={hideDeletionModal} />
    <FieldSet label={t('Prénom')} isValid={!!cleanName} isValidated={isValidated || !cleanName}>
      <Input
        type="text" placeholder={t('Prénom')} autoComplete="first-name"
        onChange={setName} value={name} onChangeDelayMillisecs={1000} />
    </FieldSet>
    <FieldSet label={t('Nom')} isValid={!!lastName} isValidated={isValidated}>
      <Input
        type="text" placeholder={t('Nom')} autoComplete="family-name"
        onChange={updateLastName} value={lastName || ''}
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
      <FieldSet label={t('Vous êtes\u00A0:')} isValid={!!gender} isValidated={isValidated}>
        <RadioGroup<bayes.bob.Gender>
          style={radioGroupStyle}
          onChange={updateGender}
          options={localizeOptions(t, GENDER_OPTIONS)} value={gender} />
      </FieldSet>
      <FieldSet
        label={t('La langue de {{productName}}\u00A0:', {productName: config.productName})}>
        <Select
          onChange={updateLanguage} value={language}
          options={localizeOptions(t, languageOptions)} />
      </FieldSet>
      {isTuPossible(language) ? <FieldSet
        label="Tutoiement" isValid={true} isValidated={isValidated}>
        <RadioGroup<boolean>
          style={radioGroupStyle} onChange={updateCanTutoie}
          options={localizeOptions(t, yesNoOptions)} value={!!canTutoie} />
      </FieldSet> : null}
      <FieldSet
        label={t('Année de naissance')}
        isValid={!!yearOfBirth} isValidated={isValidated}>
        <BirthYearSelector
          onChange={updateYearOfBirth}
          placeholder={t('choisissez une année')}
          value={yearOfBirth} />
      </FieldSet>
      <FieldSet
        label={t('Situation familiale')}
        isValid={!!familySituation}>
        <Select
          onChange={updateFamilySituation}
          options={localizeOptions(t, FAMILY_SITUATION_OPTIONS, {context: gender})}
          placeholder={t('choisissez une situation')}
          value={familySituation} />
      </FieldSet>
    </React.Fragment>}
    <RadiumDiv
      style={deleteContainerStyle}
      onClick={showDeletionModal}>
      {hasAccount ? t('Supprimer mon compte') : t('Supprimer mes données')}
    </RadiumDiv>
  </Step>
}
AccountStepBase.propTypes = {
  hasAccount: PropTypes.bool,
  isShownAsStepsDuringOnboarding: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    email: PropTypes.string,
    familySituation: PropTypes.string,
    gender: PropTypes.string,
    lastName: PropTypes.string,
    locale: PropTypes.string,
    name: PropTypes.string,
    yearOfBirth: PropTypes.string,
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const AccountStep = React.memo(AccountStepBase)


export {AccountStep}
