import {TFunction} from 'i18next'
import React, {useCallback, useMemo, useState} from 'react'
import PropTypes from 'prop-types'

import {combineTOptions} from 'store/i18n'
import {FRUSTRATION_OPTIONS, useUserExample} from 'store/user'

import Checkbox from 'components/checkbox'
import CheckboxList from 'components/checkbox_list'
import FieldSet from 'components/field_set'
import Trans from 'components/i18n_trans'
import Input from 'components/input'
import Markdown from 'components/markdown'

import {ProfileStepProps, useProfileChangeCallback, useProfileUpdater, Step} from './step'


const countryContext = {
  context: config.countryId,
} as const



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


const FrustrationsStep = (props: ProfileStepProps): React.ReactElement => {
  const {isShownAsStepsDuringOnboarding, onBack, onChange, onSubmit, profile, t,
    t: translate} = props
  const {handleBack, handleSubmit} = useProfileUpdater(fieldsRequired, profile, onSubmit, onBack)

  const [maybeShownCustomFrustrations, setMaybeShownCustomFrustrations] = useState(
    (profile.customFrustrations || []).
      map((value: string): MaybeShownFrustration => ({isShown: true, value})),
  )

  const handleChangeFrustrations = useProfileChangeCallback('frustrations', profile, onChange)
  const handleChangeCustomFrustrations =
    useProfileChangeCallback('customFrustrations', profile, onChange)
  const hasFrustrations = !!(profile.frustrations || []).length

  const userExample = useUserExample()
  const fastForward = useCallback((): void => {
    if (hasFrustrations) {
      handleSubmit()
      return
    }
    handleChangeFrustrations(userExample.profile.frustrations)
  }, [handleChangeFrustrations, handleSubmit, hasFrustrations, userExample])

  const handleChangeCustomFrustration = useCallback((index: number, value: string): void => {
    const newMaybeShownCustomFrustrations = index >= maybeShownCustomFrustrations.length ?
      [...maybeShownCustomFrustrations, {isShown: true, value}] :
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

  const {frustrations, gender} = profile
  const genderContext = useMemo(
    (): {readonly context?: string} => ({context: gender}),
    [gender])
  const filteredFrustrationOptions = FRUSTRATION_OPTIONS.
    filter(({filter}): boolean => !filter || filter(profile)).
    map(({name, isCountryDependent, value}) => ({
      name: <Markdown
        isSingleLine={true}
        content={translate(...combineTOptions(
          name, isCountryDependent ? countryContext : genderContext))} />,
      value,
    }))
  const explanation = isShownAsStepsDuringOnboarding ? <Trans>
    Y a-t-il des choses qui vous bloquent dans votre recherche d'emploi&nbsp;?<br />
  </Trans> : null
  const maybeShownCustomFrustrationsPlusOne = maybeShownCustomFrustrations.
    some(({isShown, value}): boolean => isShown && !value) ? maybeShownCustomFrustrations :
    [...maybeShownCustomFrustrations, {isShown: true, value: ''}]
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
        options={filteredFrustrationOptions}
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
FrustrationsStep.propTypes = {
  isShownAsStepsDuringOnboarding: PropTypes.bool,
  profile: PropTypes.shape({
    customFrustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
    frustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
    gender: PropTypes.string,
  }),
}


export default React.memo(FrustrationsStep)
