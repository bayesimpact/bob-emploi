import type {TFunction} from 'i18next'
import React, {useCallback, useLayoutEffect, useRef, useState} from 'react'
import type {GroupBase, SelectComponentsConfig} from 'react-select'
import {components} from 'react-select'

import {getLanguage, isGenderNeeded, localizeOptions, prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {CUSTOM_GENDER, CUSTOM_GENDER_OPTIONS, DEGREE_OPTIONS, FAMILY_SITUATION_OPTIONS,
  useUserExample} from 'store/user'

import BirthYearSelector from 'components/birth_year_selector'
import FieldSet, {OneField} from 'components/field_set'
import GrammaticalGenderSelect from 'components/grammatical_gender_select'
import type {Inputable} from 'components/input'
import Input from 'components/input'
import RacesSelector from 'components/races_selector'
import RadioGroup from 'components/radio_group'
import SameAdviceTooltip from 'components/same_advice_tooltip'
import Select from 'components/select'

import type {ProfileStepProps} from './step'
import {Step, useProfileChangeCallback, useProfileUpdater} from './step'


const yesNoOptions = [
  {name: prepareT('oui'), value: true},
  {name: prepareT('non'), value: false},
] as const

type HighestDegreeOptionProps = React.ComponentProps<Exclude<
SelectComponentsConfig<DegreeOption, false, GroupBase<DegreeOption>>['Option'],
undefined>>

const HighestDegreeOption = ({children, ...props}: HighestDegreeOptionProps):
React.ReactElement => <components.Option {...props}>
  <span style={{display: 'flex'}}>
    <span>{children}</span>
    <span style={{flex: 1}} />
    <span style={{color: colors.COOL_GREY, fontStyle: 'italic'}}>
      {props.data.equivalent}
    </span>
  </span>
</components.Option>

interface DegreeOption {
  disabled?: boolean
  equivalent?: string
  name: string
  value: bayes.bob.DegreeLevel
}
function localizeDegreeOptions(translate: TFunction): readonly DegreeOption[] {
  return DEGREE_OPTIONS.map(({equivalent, name, ...other}) => ({
    ...equivalent ? {equivalent: translate(...equivalent)} : {},
    name: translate(...name),
    ...other,
  }))
}


const existingCustomGenderOptions = new Set(CUSTOM_GENDER_OPTIONS.map(({value}) => value))

interface CustomGenderSelectProps {
  ['aria-labelledby']?: string
  onChange: (customGender: string) => void
  value?: string
  t: TFunction
}

const CustomGenderSelectBase = (props: CustomGenderSelectProps): React.ReactElement => {
  const {'aria-labelledby': ariaLabelledBy, onChange, t, value} = props

  const text = value && existingCustomGenderOptions.has(value) ? undefined : value
  const [option, setOption] = useState(text ? CUSTOM_GENDER : value)
  const isInputShown = option === CUSTOM_GENDER
  const [wasInputHidden, setWasInputHidden] = useState(!isInputShown)
  useLayoutEffect(() => setWasInputHidden(!isInputShown), [isInputShown])
  const extraInputRef = useRef<Inputable>(null)
  useLayoutEffect(() => {
    if (isInputShown && wasInputHidden) {
      extraInputRef.current?.focus?.()
    }
  }, [isInputShown, wasInputHidden])
  const handleChangeOption = useCallback((option: string) => {
    setOption(option)
    if (option !== CUSTOM_GENDER) {
      onChange(option)
      return
    }
  }, [onChange])

  return <React.Fragment>
    <Select
      onChange={handleChangeOption}
      options={localizeOptions(t, CUSTOM_GENDER_OPTIONS)}
      placeholder={t('votre genre')}
      value={option} aria-labelledby={ariaLabelledBy} />
    {isInputShown ? <Input
      ref={extraInputRef} name="custom-gender" autoComplete="sex"
      value={text}
      onChange={onChange}
      onChangeDelayMillisecs={1000}
      placeholder={t('agenre, bigenre, fluide, …')} style={{marginTop: 5}} /> : null}
  </React.Fragment>
}
const CustomGenderSelect = React.memo(CustomGenderSelectBase)


const fieldsRequired = {
  familySituation: true,
  gender: false,
  hasHandicap: false,
  highestDegree: true,
  yearOfBirth: true,
} as const


const fieldsOrder = ['gender', 'yearOfBirth', 'familySituation', 'highestDegree'] as const


const GeneralStep = (props: ProfileStepProps): React.ReactElement => {
  const {
    isShownAsStepsDuringOnboarding, onChange, onSubmit, profile,
    profile: {
      customGender, familySituation, gender, hasCompletedOnboarding, hasHandicap, highestDegree,
      isArmyVeteran, locale, races, yearOfBirth,
    }, t} = props

  const {handleSubmit, inputsRefMap, isFormValid, isValidated} =
    useProfileUpdater(fieldsRequired, profile, onSubmit, undefined, fieldsOrder)

  const handleChangeFamilySituation = useProfileChangeCallback('familySituation', profile, onChange)
  const handleChangeGender = useProfileChangeCallback('gender', profile, onChange)
  const handleChangeYearOfBirth = useProfileChangeCallback('yearOfBirth', profile, onChange)
  const handleChangeHighestDegree = useProfileChangeCallback('highestDegree', profile, onChange)
  const handleChangeHasHandicap = useProfileChangeCallback('hasHandicap', profile, onChange)
  const handleChangeVeteran = useProfileChangeCallback('isArmyVeteran', profile, onChange)
  const handleChangeRaces = useProfileChangeCallback('races', profile, onChange)
  const handleChangeCustomGender = useProfileChangeCallback('customGender', profile, onChange)

  const language = getLanguage(locale)
  const userExample = useUserExample()
  const fastForward = useCallback((): void => {
    if (isFormValid) {
      handleSubmit()
      return
    }

    const {familySituation, gender, highestDegree, yearOfBirth} = profile
    const profileDiff: {-readonly [K in keyof bayes.bob.UserProfile]?: bayes.bob.UserProfile[K]} =
      {}
    if (!gender && isGenderNeeded(language)) {
      profileDiff.gender = userExample.profile.gender
    }
    if (!familySituation) {
      profileDiff.familySituation = userExample.profile.familySituation
    }
    if (!highestDegree) {
      profileDiff.highestDegree = userExample.profile.highestDegree
    }
    if (!yearOfBirth) {
      profileDiff.yearOfBirth = userExample.profile.yearOfBirth
    }
    onChange?.({profile: profileDiff})
  }, [isFormValid, handleSubmit, language, onChange, profile, userExample])

  const [isGenderQuestionShown] = useState((): boolean => isGenderNeeded(language) ?
    // If gender is needed: only show it during the first onboarding or if it's unset.
    !hasCompletedOnboarding || !gender :
    // Gender is not required: only show it if it was set.
    !hasCompletedOnboarding && !!gender)

  const [isFamilySituationQuestionShown] = useState((): boolean =>
    !hasCompletedOnboarding || !familySituation)

  const [isYearOfBirthQuestionShown] = useState((): boolean =>
    !hasCompletedOnboarding || !yearOfBirth)

  // Keep in sync with 'isValid' fields from fieldset below.
  const checks = [
    !isGenderQuestionShown || !!gender,
    !isYearOfBirthQuestionShown || !!yearOfBirth,
    !isFamilySituationQuestionShown || !!familySituation,
    !!highestDegree,
  ]
  const radioGroupStyle = isShownAsStepsDuringOnboarding ? {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-around',
  } : {
    display: 'grid',
    gridTemplate: '1fr / 1fr 1fr',
    maxWidth: 260,
  }
  return <Step
    title={t('Votre profil')}
    fastForward={fastForward}
    progressInStep={checks.filter(Boolean).length / (checks.length + 1)}
    onNextButtonClick={handleSubmit}
    // Hide Previous button.
    onPreviousButtonClick={null}
    {...props}>
    {isGenderQuestionShown ?
      <GrammaticalGenderSelect
        gender={gender} customGender={customGender} ref={inputsRefMap.gender}
        onChange={handleChangeGender} onCustomGenderChange={handleChangeCustomGender}
        isValidated={isValidated} isGenderNeeded={isGenderNeeded(language)}
        radioGroupStyle={radioGroupStyle} isQuestion={true} /> : null}
    {checks[0] && isYearOfBirthQuestionShown ? <OneField
      label={t('En quelle année êtes-vous né·e\u00A0?', {context: gender})}
      isValid={!!yearOfBirth} isValidated={isValidated} hasCheck={true}>
      <BirthYearSelector
        onChange={handleChangeYearOfBirth}
        ref={inputsRefMap.yearOfBirth}
        placeholder={t('choisissez une année')}
        value={yearOfBirth} />
    </OneField> : null}
    {checks.slice(0, 2).every(Boolean) && isFamilySituationQuestionShown ? <OneField
      label={t('Quelle est votre situation familiale\u00A0?')}
      isValid={!!familySituation}
      isValidated={isValidated} hasCheck={true}>
      <Select<bayes.bob.FamilySituation>
        ref={inputsRefMap.familySituation}
        onChange={handleChangeFamilySituation}
        options={localizeOptions(t, FAMILY_SITUATION_OPTIONS)}
        placeholder={t('choisissez une situation')}
        value={familySituation} />
    </OneField> : null}
    {checks.slice(0, 3).every(Boolean) ? <OneField
      label={t('Quel est le dernier diplôme que vous avez obtenu\u00A0?')}
      isValid={!!highestDegree} isValidated={isValidated} hasCheck={true}>
      <Select<bayes.bob.DegreeLevel>
        ref={inputsRefMap.highestDegree}
        onChange={handleChangeHighestDegree} value={highestDegree}
        components={{Option: HighestDegreeOption}}
        options={localizeDegreeOptions(t)}
        placeholder={t("choisissez un niveau d'études")} />
    </OneField> : null}
    {!isGenderQuestionShown && checks.slice(0, 4).every(Boolean) ? <OneField
      label={t('Laquelle de ces options vous correspond le mieux\u00A0?')}
      tooltip={<SameAdviceTooltip />}
      isValid={!!customGender} isValidated={isValidated && !!customGender} hasCheck={true}>
      <CustomGenderSelect value={customGender} onChange={handleChangeCustomGender} t={t} />
    </OneField> : null}
    {config.isRaceEnabled && checks.slice(0, 4).every(Boolean) ? <FieldSet
      legend={t(
        'De quelle race ou ethnie êtes-vous\u00A0? Cochez toutes celles qui correspondent.')}
      tooltip={<SameAdviceTooltip />}
      isValid={true} isValidated={isValidated} style={{minWidth: isMobileVersion ? 280 : 350}}>
      <RacesSelector values={races} onChange={handleChangeRaces} />
    </FieldSet> : null}
    {checks.slice(0, 4).every(Boolean) ? <OneField
      label={t(
        'Êtes-vous reconnu·e comme travailleu·r·se handicapé·e\u00A0?', {context: gender})}
      isValid={true} isValidated={isValidated} style={{minWidth: isMobileVersion ? 280 : 350}}
      hasCheck={true}>
      <RadioGroup<boolean>
        style={radioGroupStyle}
        onChange={handleChangeHasHandicap}
        options={localizeOptions(t, yesNoOptions)} value={!!hasHandicap} />
    </OneField> : null}
    {config.isVeteranEnabled && checks.slice(0, 4).every(Boolean) ? <OneField
      label={t(
        "Êtes-vous reconnu·e comme vétéran·e de l'armée\u00A0?", {context: gender})}
      isValid={true} isValidated={isValidated} style={{minWidth: isMobileVersion ? 280 : 350}}>
      <RadioGroup<boolean>
        style={radioGroupStyle}
        onChange={handleChangeVeteran}
        options={localizeOptions(t, yesNoOptions)} value={!!isArmyVeteran} />
    </OneField> : null}
  </Step>
}


export default React.memo(GeneralStep)
