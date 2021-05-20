import {TFunction} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useState} from 'react'
import {components} from 'react-select'

import {getLanguage, isGenderNeeded, localizeOptions, prepareT} from 'store/i18n'
import {DEGREE_OPTIONS, GENDER_OPTIONS, FAMILY_SITUATION_OPTIONS, useUserExample} from 'store/user'

import BirthYearSelector from 'components/birth_year_selector'
import FieldSet from 'components/field_set'
import isMobileVersion from 'store/mobile'
import InformationIcon from 'components/information_icon'
import RadioGroup from 'components/radio_group'
import Select from 'components/select'

import {ProfileStepProps, Step, useProfileChangeCallback, useProfileUpdater} from './step'


const hasHandicapOptions = [
  {name: prepareT('oui'), value: true},
  {name: prepareT('non'), value: false},
] as const


type HighestDegreeOptionProps = React.ComponentProps<typeof components['Option']>
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


const fieldsRequired = {
  familySituation: true,
  gender: false,
  hasHandicap: false,
  highestDegree: true,
  yearOfBirth: true,
} as const


const GeneralStep = (props: ProfileStepProps): React.ReactElement => {
  const {isShownAsStepsDuringOnboarding, onChange, onSubmit, profile, profile: {familySituation,
    gender, hasCompletedOnboarding, hasHandicap, highestDegree, locale, yearOfBirth}, t} = props

  const {isFormValid, isValidated, handleSubmit} =
    useProfileUpdater(fieldsRequired, profile, onSubmit)

  const handleChangeFamilySituation = useProfileChangeCallback('familySituation', profile, onChange)
  const handleChangeGender = useProfileChangeCallback('gender', profile, onChange)
  const handleChangeYearOfBirth = useProfileChangeCallback('yearOfBirth', profile, onChange)
  const handleChangeHighestDegree = useProfileChangeCallback('highestDegree', profile, onChange)
  const handleChangeHasHandicap = useProfileChangeCallback('hasHandicap', profile, onChange)

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
    !isFamilySituationQuestionShown || !!familySituation,
    !isYearOfBirthQuestionShown || !!yearOfBirth,
    !!highestDegree,
  ]
  const radioGroupStyle = isShownAsStepsDuringOnboarding ? {
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
    progressInStep={checks.filter((c): boolean => c).length / (checks.length + 1)}
    onNextButtonClick={isFormValid ? handleSubmit : undefined}
    // Hide Previous button.
    onPreviousButtonClick={null}
    {...props}>
    {isGenderQuestionShown ? <FieldSet
      label={<React.Fragment>
        {t('Vous êtes\u00A0:')}
        <InformationIcon tooltipWidth={220}>
          {t(
            'Vous aurez accès au même contenu. {{productName}} se sert de cette information ' +
            "uniquement pour savoir s'il faut parler de vous au masculin ou au féminin.",
            {productName: config.productName},
          )}
        </InformationIcon>
      </React.Fragment>}
      isValid={!!gender} isValidated={isValidated}>
      <RadioGroup<bayes.bob.Gender>
        style={radioGroupStyle}
        onChange={handleChangeGender}
        options={localizeOptions(t, GENDER_OPTIONS)} value={gender} />
    </FieldSet> : null}
    {checks[0] && isFamilySituationQuestionShown ? <FieldSet
      label={t('Quelle est votre situation familiale\u00A0?')}
      isValid={!!familySituation}
      isValidated={isValidated} hasCheck={true}>
      <Select
        onChange={handleChangeFamilySituation}
        options={localizeOptions(t, FAMILY_SITUATION_OPTIONS)}
        placeholder={t('choisissez une situation')}
        value={familySituation} />
    </FieldSet> : null}
    {checks.slice(0, 2).every((c): boolean => c) && isYearOfBirthQuestionShown ? <FieldSet
      label={t('En quelle année êtes-vous né·e\u00A0?', {context: gender})}
      isValid={!!yearOfBirth} isValidated={isValidated} hasCheck={true}>
      <BirthYearSelector
        onChange={handleChangeYearOfBirth}
        placeholder={t('choisissez une année')}
        value={yearOfBirth} />
    </FieldSet> : null}
    {checks.slice(0, 3).every((c): boolean => c) ? <FieldSet
      label={t('Quel est le dernier diplôme que vous avez obtenu\u00A0?')}
      isValid={!!highestDegree} isValidated={isValidated} hasCheck={true}>
      <Select<bayes.bob.DegreeLevel>
        onChange={handleChangeHighestDegree} value={highestDegree}
        components={{Option: HighestDegreeOption}}
        options={localizeDegreeOptions(t)}
        placeholder={t("choisissez un niveau d'études")} />
    </FieldSet> : null}
    {/* TODO(pascal): Please remove the left padding on the fieldset, I can't get rid of it */}
    {checks.slice(0, 4).every((c): boolean => c) ? <FieldSet
      label={t(
        'Êtes-vous reconnu·e comme travailleu·r·se handicapé·e\u00A0?', {context: gender})}
      isValid={true} isValidated={isValidated} style={{minWidth: isMobileVersion ? 280 : 350}}>
      <RadioGroup<boolean>
        style={radioGroupStyle}
        onChange={handleChangeHasHandicap}
        options={localizeOptions(t, hasHandicapOptions)} value={!!hasHandicap} />
    </FieldSet> : null}
  </Step>
}
GeneralStep.propTypes = {
  featuresEnabled: PropTypes.object,
  isShownAsStepsDuringOnboarding: PropTypes.bool,
  onChange: PropTypes.func,
  profile: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}



export default React.memo(GeneralStep)
