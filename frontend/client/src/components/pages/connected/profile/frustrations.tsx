import {TFunction} from 'i18next'
import React, {useCallback, useState} from 'react'
import PropTypes from 'prop-types'

import {Trans} from 'components/i18n'
import {Checkbox, Input} from 'components/theme'
import {CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

import {ProfileStepProps, useProfileChangeCallback, useProfileUpdater, Step} from './step'

// This is a stunt to acknowledge that we do not name what could be a named
// React component (an alternative would be to systimatically disable the
// react/display-name rule).
const unnamedComponent = (c: React.ReactNode): React.ReactNode => c


interface FrustrationOption {
  name: (gender?: bayes.bob.Gender) => React.ReactNode
  value: bayes.bob.Frustration
}


const jobSearchFrustrationOptions: readonly FrustrationOption[] = [
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le <strong>manque d'offres</strong>, correspondant à mes critères
    </Trans>),
    value: 'NO_OFFERS',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le <strong>manque de réponses</strong> des recruteurs, même négatives
    </Trans>),
    value: 'NO_OFFER_ANSWERS',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      La rédaction des <strong>CVs</strong> et <strong>lettres de motivation</strong>
    </Trans>),
    value: 'RESUME',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Les <strong>entretiens</strong> d'embauche
    </Trans>),
    value: 'INTERVIEW',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le système des <strong>formations</strong> professionnelles
    </Trans>),
    value: 'TRAINING',
  },
  {
    name: (gender?: bayes.bob.Gender): React.ReactNode => unnamedComponent(<Trans
      parent="span" tOptions={{context: gender}}>
      La difficulté de <strong>rester motivé·e</strong> dans ma recherche
    </Trans>),
    value: 'MOTIVATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le manque de <strong>confiance en moi</strong>
    </Trans>),
    value: 'SELF_CONFIDENCE',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      La gestion de mon temps pour être <strong>efficace</strong>
    </Trans>),
    value: 'TIME_MANAGEMENT',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      L'<strong>expérience demandée</strong> pour le poste
    </Trans>),
    value: 'EXPERIENCE',
  },
] as const


const personalFrustrationOptions: readonly FrustrationOption[] = [
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      <strong>Ne pas rentrer dans les cases</strong> des recruteurs
    </Trans>),
    value: 'ATYPIC_PROFILE',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Des discriminations liées à mon <strong>âge</strong>
    </Trans>),
    value: 'AGE_DISCRIMINATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Des discriminations liées à mon <strong>sexe</strong>
    </Trans>),
    value: 'SEX_DISCRIMINATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      L'interruption de ma carrière pour <strong>élever mes enfants</strong>.
    </Trans>),
    value: 'STAY_AT_HOME_PARENT',
  },
] as const


const parentSituation: Set<bayes.bob.FamilySituation> =
  new Set(['SINGLE_PARENT_SITUATION', 'FAMILY_WITH_KIDS'])
const isPotentialLongTermMom = ({familySituation, gender}: bayes.bob.UserProfile): boolean =>
  gender === 'FEMININE' && !!familySituation && parentSituation.has(familySituation)



interface SelectOption {
  name: React.ReactNode
  value: bayes.bob.Frustration
}


interface GenderizableSelectOption {
  name: (gender?: bayes.bob.Gender) => React.ReactNode
  value: bayes.bob.Frustration
}


const genderizedOptions =
  (options: readonly GenderizableSelectOption[], profile: bayes.bob.UserProfile):
  readonly SelectOption[] =>
    options.map(
      ({name, value}: GenderizableSelectOption): SelectOption =>
        ({name: name(profile.gender), value})).
      filter(({value}: SelectOption): boolean =>
        (profile.gender === 'FEMININE' || value !== 'SEX_DISCRIMINATION') &&
        (isPotentialLongTermMom(profile) || value !== 'STAY_AT_HOME_PARENT'))


interface CustomFrustrationProps {
  index: number
  onChange?: (index: number, value: string) => void
  onRemove?: (index: number) => void
  t: TFunction
  value?: string
}


const customFrustrationStyle = {
  alignItems: 'center',
  display: 'flex',
  marginBottom: 10,
  width: '100%',
}
const inputStyle = {
  flex: 1,
  height: 35,
  marginLeft: 10,
  width: 'initial',
}


const CustomFrustrationBase = (props: CustomFrustrationProps): React.ReactElement => {
  const {index, onChange, onRemove, t, value} = props
  const [isSelected, setIsSelected] = useState(!!value)
  const handleEditValue = useCallback((v: string): void => {
    isSelected === !v && setIsSelected(!!v)
  }, [isSelected])

  const handleChange = useCallback(
    (value: string): void => onChange?.(index, value),
    [index, onChange],
  )

  const handleRemove = useCallback(
    (): void => onRemove?.(index),
    [index, onRemove],
  )

  const removeEmpty = useCallback((): void => {
    if (!isSelected) {
      handleRemove()
    }
  }, [handleRemove, isSelected])

  return <div style={customFrustrationStyle}>
    <Checkbox
      isSelected={isSelected}
      onClick={isSelected ? handleRemove : undefined} />
    <Input
      value={value} style={inputStyle}
      placeholder={t('Autre…')} onChangeDelayMillisecs={1000}
      onEdit={handleEditValue}
      onChange={handleChange} onBlur={removeEmpty} />
  </div>
}
CustomFrustrationBase.propTypes = {
  onChange: PropTypes.func,
  onRemove: PropTypes.func,
  t: PropTypes.func.isRequired,
  value: PropTypes.string,
}
const CustomFrustration = React.memo(CustomFrustrationBase)


interface MaybeShownFrustration {
  isShown: boolean
  value: string
}


const computeCustomFrustrations =
  (maybeShownCustomFrustrations: readonly MaybeShownFrustration[]): readonly string[] => {
    return maybeShownCustomFrustrations.
      filter(({isShown, value}): boolean => isShown && !!value).map(({value}): string => value)
  }


const fieldsRequired = {
  customFrustrations: false,
  frustrations: false,
} as const


const FrustrationsStepBase = (props: ProfileStepProps): React.ReactElement => {
  const {isShownAsStepsDuringOnboarding, onBack, onChange, onSubmit, profile, t} = props
  const {handleBack, handleSubmit} = useProfileUpdater(fieldsRequired, profile, onSubmit, onBack)

  const [maybeShownCustomFrustrations, setMaybeShownCustomFrustrations] = useState(
    (profile.customFrustrations || []).
      map((value: string): MaybeShownFrustration => ({isShown: true, value})),
  )

  const handleChangeFrustrations = useProfileChangeCallback('frustrations', profile, onChange)
  const handleChangeCustomFrustrations =
    useProfileChangeCallback('customFrustrations', profile, onChange)
  const hasFrustrations = !!(profile.frustrations || []).length

  const fastForward = useCallback((): void => {
    if (hasFrustrations) {
      handleSubmit()
      return
    }
    const frustrations: bayes.bob.Frustration[] = []
    jobSearchFrustrationOptions.concat(personalFrustrationOptions).forEach(
      (frustration): void => {
        if (Math.random() > .5) {
          frustrations.push(frustration.value)
        }
      })
    handleChangeFrustrations(frustrations)
  }, [handleChangeFrustrations, handleSubmit, hasFrustrations])

  const handleChangeCustomFrustration = useCallback((index: number, value: string): void => {
    const newMaybeShownCustomFrustrations = index >= maybeShownCustomFrustrations.length ?
      maybeShownCustomFrustrations.concat({isShown: true, value}) :
      maybeShownCustomFrustrations.
        map(({isShown, value: oldValue}, i): MaybeShownFrustration =>
          ({isShown, value: (i === index) ? value : oldValue}))
    setMaybeShownCustomFrustrations(newMaybeShownCustomFrustrations)
    handleChangeCustomFrustrations(computeCustomFrustrations(newMaybeShownCustomFrustrations))
  }, [handleChangeCustomFrustrations, maybeShownCustomFrustrations])

  const handleRemoveCustomFrustration = useCallback((index: number): void => {
    if (index >= maybeShownCustomFrustrations.length) {
      return
    }
    const newMaybeShownCustomFrustrations = maybeShownCustomFrustrations.
      map(({isShown, value}, i): MaybeShownFrustration =>
        ({isShown: i !== index && isShown, value}))
    setMaybeShownCustomFrustrations(newMaybeShownCustomFrustrations)
    handleChangeCustomFrustrations(computeCustomFrustrations(newMaybeShownCustomFrustrations))
  }, [handleChangeCustomFrustrations, maybeShownCustomFrustrations])

  const {frustrations} = profile
  const genderizedFrustrationOptions = genderizedOptions(
    jobSearchFrustrationOptions.concat(personalFrustrationOptions), profile)
  const explanation = isShownAsStepsDuringOnboarding ? <Trans>
    Y a-t-il des choses qui vous bloquent dans votre recherche d'emploi&nbsp;?<br />
  </Trans> : null
  const maybeShownCustomFrustrationsPlusOne = maybeShownCustomFrustrations.
    some(({isShown, value}): boolean => isShown && !value) ? maybeShownCustomFrustrations :
    maybeShownCustomFrustrations.concat([{isShown: true, value: ''}])
  const label = isShownAsStepsDuringOnboarding ? '' : t('Éléments bloquants de votre recherche')
  return <Step
    title={t('Vos éventuelles difficultés')}
    explanation={explanation}
    fastForward={fastForward}
    onNextButtonClick={handleSubmit}
    onPreviousButtonClick={handleBack}
    {...props}>
    <FieldSet isInline={isShownAsStepsDuringOnboarding} label={label}>
      <CheckboxList<bayes.bob.Frustration>
        options={genderizedFrustrationOptions}
        values={frustrations}
        onChange={handleChangeFrustrations} />
    </FieldSet>
    {maybeShownCustomFrustrationsPlusOne.map(({isShown, value}, index): React.ReactNode =>
      isShown ? <CustomFrustration
        key={index} value={value} t={t} index={index}
        onChange={handleChangeCustomFrustration}
        onRemove={handleRemoveCustomFrustration} /> : null)}
  </Step>
}
FrustrationsStepBase.propTypes = {
  isShownAsStepsDuringOnboarding: PropTypes.bool,
  profile: PropTypes.shape({
    customFrustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
    frustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
    gender: PropTypes.string,
  }),
}
const FrustrationsStep = React.memo(FrustrationsStepBase)


export {FrustrationsStep}
