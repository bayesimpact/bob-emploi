import LockOutlineIcon from 'mdi-react/LockOutlineIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'

import {LocalizableString, getLanguage, getLocaleWithTu, isGenderNeeded, isTuPossible,
  localizeOptions, prepareT} from 'store/i18n'
import {GENDER_OPTIONS, FAMILY_SITUATION_OPTIONS} from 'store/user'

import AccountDeletionModal from 'components/account_deletion_modal'
import BirthYearSelector from 'components/birth_year_selector'
import FieldSet from 'components/field_set'
import IconInput from 'components/icon_input'
import InformationIcon from 'components/information_icon'
import Input from 'components/input'
import {LoginButton} from 'components/login'
import {useModal} from 'components/modal'
import RadioGroup from 'components/radio_group'
import {RadiumDiv} from 'components/radium'
import Select from 'components/select'

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
  ':hover': {color: colors.DARK_TWO},
  'alignSelf': 'start',
  'color': colors.COOL_GREY,
  'cursor': 'pointer',
  'fontSize': 15,
  'padding': 0,
}


const AccountStep: React.FC<ProfileStepProps> = (props): React.ReactElement => {
  const {hasAccount, isShownAsStepsDuringOnboarding, profile, onChange, onSubmit, t} = props
  const {email, familySituation, gender, hasHandicap, lastName, locale, name: nameProp,
    yearOfBirth} = profile
  const [isAccountDeletionModalShown, showDeletionModal, hideDeletionModal] = useModal(false)

  const {handleSubmit, isValidated} = useProfileUpdater(fieldsRequired, profile, onSubmit)
  const updateFamilySituation = useProfileChangeCallback('familySituation', profile, onChange)
  const updateGender = useProfileChangeCallback('gender', profile, onChange)
  const updateHasHandicap = useProfileChangeCallback('hasHandicap', profile, onChange)
  const updateLastName = useProfileChangeCallback('lastName', profile, onChange)
  const updateLocale = useProfileChangeCallback('locale', profile, onChange)
  const updateName = useProfileChangeCallback('name', profile, onChange)
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
    <FieldSet label={t('Prénom')} isValid={!!cleanName} isValidated={isValidated || !cleanName}>
      <Input
        type="text" placeholder={t('Prénom')} autoComplete="first-name"
        onChange={setName} value={name} onChangeDelayMillisecs={1000} />
    </FieldSet>
    {isLastNameEditable ? <FieldSet label={t('Nom')} isValid={!!lastName} isValidated={isValidated}>
      <Input
        type="text" placeholder={t('Nom')} autoComplete="family-name"
        onChange={updateLastName} value={lastName || ''}
        onChangeDelayMillisecs={1000} />
    </FieldSet> : null}
    {hasAccount ? <FieldSet label={t('Email')} isValid={!!email} isValidated={isValidated}>
      <IconInput
        type="text" style={{color: colors.COOL_GREY}} iconComponent={LockOutlineIcon}
        value={email} readOnly={true} />
    </FieldSet> : <LoginButton
      type="navigation" visualElement="account"
      style={{alignSelf: 'center', marginBottom: 25}}>
      {t('Créer mon compte')}
    </LoginButton>}
    {isShownAsStepsDuringOnboarding ? null : <React.Fragment>
      {gender || isGenderNeeded(language) ? <FieldSet label={<React.Fragment>
        {t('Vous êtes\u00A0:')}
        <InformationIcon tooltipWidth={220}>
          {t(
            'Vous aurez accès au même contenu. {{productName}} se sert de cette information ' +
            "uniquement pour savoir s'il faut parler de vous au masculin ou au féminin.",
            {productName: config.productName},
          )}
        </InformationIcon>
      </React.Fragment>} isValid={!!gender} isValidated={isValidated}>
        <RadioGroup<bayes.bob.Gender>
          style={radioGroupStyle}
          onChange={updateGender}
          options={localizeOptions(t, GENDER_OPTIONS)} value={gender} />
      </FieldSet> : null}
      <FieldSet
        label={t('La langue de {{productName}}\u00A0:', {productName: config.productName})}>
        <Select
          onChange={updateLanguage} value={language}
          options={localizedLanguageOptions} />
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
      <FieldSet
        label={t(
          'Reconnu·e comme travailleu·r·se handicapé·e\u00A0?', {context: gender})}
        isValid={hasHandicap !== undefined}>
        <RadioGroup<boolean>
          style={radioGroupStyle}
          onChange={updateHasHandicap}
          options={localizeOptions(t, yesNoOptions)} value={!!hasHandicap} />
      </FieldSet>
    </React.Fragment>}
    <RadiumDiv
      style={deleteContainerStyle}
      onClick={showDeletionModal}>
      {hasAccount ? t('Supprimer mon compte') : t('Supprimer mes données')}
    </RadiumDiv>
  </Step>
}
AccountStep.propTypes = {
  hasAccount: PropTypes.bool,
  isShownAsStepsDuringOnboarding: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    email: PropTypes.string,
    familySituation: PropTypes.string,
    gender: PropTypes.string,
    hasHandicap: PropTypes.bool,
    lastName: PropTypes.string,
    locale: PropTypes.string,
    name: PropTypes.string,
    yearOfBirth: PropTypes.number,
  }).isRequired,
  t: PropTypes.func.isRequired,
}


export default React.memo(AccountStep)
