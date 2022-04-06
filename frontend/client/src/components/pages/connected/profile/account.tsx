import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import React, {useCallback, useMemo, useState} from 'react'

import type {LocalizableString} from 'store/i18n'
import {getLanguage, getLocaleWithTu, isGenderNeeded, isTuPossible,
  localizeOptions, prepareT} from 'store/i18n'
import {FAMILY_SITUATION_OPTIONS} from 'store/user'

import AccountDeletionModal from 'components/account_deletion_modal'
import Button from 'components/button'
import BirthYearSelector from 'components/birth_year_selector'
import FieldSet, {OneField} from 'components/field_set'
import GrammaticalGenderSelect from 'components/grammatical_gender_select'
import IconInput from 'components/icon_input'
import Input from 'components/input'
import {LoginButton} from 'components/login'
import {useModal} from 'components/modal'
import RacesSelector from 'components/races_selector'
import RadioGroup from 'components/radio_group'
import SameAdviceTooltip from 'components/same_advice_tooltip'
import Select from 'components/select'

import type {ProfileStepProps} from './step'
import {Step, useProfileChangeCallback, useProfileUpdater} from './step'


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


const languageOptions: readonly {name: LocalizableString; value: string}[] = [
  {name: prepareT('français'), value: 'fr'},
  {name: prepareT('anglais (États-Unis)'), value: 'en'},
  {name: prepareT('anglais (Royaume Uni)'), value: 'en_UK'},
] as const


const radioGroupStyle = {
  display: 'flex',
  justifyContent: 'space-around',
}

const deleteContainerStyle: RadiumCSSProperties = {
  alignSelf: 'start',
  fontSize: 15,
  // Compensate the padding to align the text, no the button.
  transform: 'translateX(-20px)',
}


const AccountStep: React.FC<ProfileStepProps> = (props): React.ReactElement => {
  const {hasAccount, isShownAsStepsDuringOnboarding, profile, onChange, onSubmit, t} = props
  const {customGender, email, familySituation, gender, hasHandicap, isArmyVeteran, lastName, locale,
    name: nameProp, races, yearOfBirth} = profile
  const [isAccountDeletionModalShown, showDeletionModal, hideDeletionModal] = useModal(false)

  const {handleSubmit, isValidated} = useProfileUpdater(fieldsRequired, profile, onSubmit)
  const updateFamilySituation = useProfileChangeCallback('familySituation', profile, onChange)
  const updateCustomGender = useProfileChangeCallback('customGender', profile, onChange)
  const updateGender = useProfileChangeCallback('gender', profile, onChange)
  const updateHasHandicap = useProfileChangeCallback('hasHandicap', profile, onChange)
  const updateIsArmyVeteran = useProfileChangeCallback('isArmyVeteran', profile, onChange)
  const updateLastName = useProfileChangeCallback('lastName', profile, onChange)
  const updateLocale = useProfileChangeCallback('locale', profile, onChange)
  const updateName = useProfileChangeCallback('name', profile, onChange)
  const updateRaces = useProfileChangeCallback('races', profile, onChange)
  const updateYearOfBirth = useProfileChangeCallback('yearOfBirth', profile, onChange)

  const [name, setDirtyName] = useState(nameProp || '')
  const [isLastNameEditable] = useState(!!lastName)
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
  const translate = t
  const localizedLanguageOptions = useMemo(() => languageOptions.map(({name, value}) => ({
    name: config.defaultLang === value ?
      translate(...name) :
      t('{{language}} - expérimental', {language: translate(...name)}),
    value,
  })), [t, translate])
  return <Step
    title={t('Vos informations')} fastForward={handleSubmit}
    onNextButtonClick={handleSubmit} {...props}>
    <AccountDeletionModal isShown={isAccountDeletionModalShown} onClose={hideDeletionModal} />
    <OneField label={t('Prénom')} isValid={!!cleanName} isValidated={isValidated || !cleanName}>
      <Input
        type="text" placeholder={t('Prénom')} autoComplete="given-name" name="given-name"
        onChange={setName} value={name} onChangeDelayMillisecs={1000} />
    </OneField>
    {isLastNameEditable ? <OneField label={t('Nom')} isValid={!!lastName} isValidated={isValidated}>
      <Input
        type="text" placeholder={t('Nom')} autoComplete="family-name" name="family-name"
        onChange={updateLastName} value={lastName || ''}
        onChangeDelayMillisecs={1000} />
    </OneField> : null}
    {hasAccount ? <OneField label={t('Email')} isValid={!!email} isValidated={isValidated}>
      <IconInput
        type="text" style={{color: colors.COOL_GREY}} iconComponent={LockOutlineIcon}
        value={email} readOnly={true} name="email" autoComplete="email" />
    </OneField> : <LoginButton
      type="navigation" visualElement="account"
      style={{alignSelf: 'center', marginBottom: 25}}>
      {t('Créer mon compte')}
    </LoginButton>}
    {isShownAsStepsDuringOnboarding ? null : <React.Fragment>
      {gender || isGenderNeeded(language) ? <GrammaticalGenderSelect
        isValidated={isValidated} onChange={updateGender} gender={gender || 'UNKNOWN_GENDER'}
        onCustomGenderChange={updateCustomGender} customGender={customGender}
        isGenderNeeded={isGenderNeeded(language)}
        radioGroupStyle={radioGroupStyle} /> : null}
      <OneField
        label={t('La langue de {{productName}}\u00A0:', {productName: config.productName})}>
        <Select
          onChange={updateLanguage} value={language}
          options={localizedLanguageOptions} />
      </OneField>
      {isTuPossible(language) ? <OneField
        label="Tutoiement" isValid={true} isValidated={isValidated}>
        <RadioGroup<boolean>
          style={radioGroupStyle} onChange={updateCanTutoie}
          options={localizeOptions(t, yesNoOptions)} value={!!canTutoie} />
      </OneField> : null}
      <OneField
        label={t('Année de naissance')}
        isValid={!!yearOfBirth} isValidated={isValidated}>
        <BirthYearSelector
          onChange={updateYearOfBirth}
          placeholder={t('choisissez une année')}
          value={yearOfBirth} />
      </OneField>
      <OneField
        label={t('Situation familiale')}
        isValid={!!familySituation}>
        <Select<bayes.bob.FamilySituation>
          onChange={updateFamilySituation}
          options={localizeOptions(t, FAMILY_SITUATION_OPTIONS, {context: gender})}
          placeholder={t('choisissez une situation')}
          value={familySituation} />
      </OneField>
      <OneField
        label={t(
          'Reconnu·e comme travailleu·r·se handicapé·e\u00A0?', {context: gender})}
        isValid={hasHandicap !== undefined}>
        <RadioGroup<boolean>
          style={radioGroupStyle}
          onChange={updateHasHandicap}
          options={localizeOptions(t, yesNoOptions)} value={!!hasHandicap} />
      </OneField>
      {config.isVeteranEnabled ? <OneField
        label={t(
          "Reconnu·e comme vétéran·e de l'armée\u00A0?", {context: gender})}
        isValid={isArmyVeteran !== undefined}>
        <RadioGroup<boolean>
          style={radioGroupStyle}
          onChange={updateIsArmyVeteran}
          options={localizeOptions(t, yesNoOptions)} value={!!isArmyVeteran} />
      </OneField> : null}
      {config.isRaceEnabled ? <FieldSet
        legend={t('Race ou ethnie')} tooltip={<SameAdviceTooltip />} isValid={true}>
        <RacesSelector values={races} onChange={updateRaces} />
      </FieldSet> : null}
    </React.Fragment>}
    <Button style={deleteContainerStyle} onClick={showDeletionModal} type="discreet">
      {hasAccount ? t('Supprimer mon compte') : t('Supprimer mes données')}
    </Button>
  </Step>
}


export default React.memo(AccountStep)
