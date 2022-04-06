import React, {useCallback, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {localizeOptions} from 'store/i18n'
import {RACE_OPTIONS} from 'store/user'

import CheckboxList from 'components/checkbox_list'
import LabeledToggle from 'components/labeled_toggle'
import type {Inputable} from 'components/input'
import Input from 'components/input'

// This file uses "translation" ns (instead of "components") as it's using some translations
// prepared in the store.
// i18next-extract-mark-ns-start translation

interface Props {
  gender?: bayes.bob.Gender
  onChange: (races: readonly string[]) => void
  values?: readonly string[]
}

const existingOptions = new Set(RACE_OPTIONS.map(({value}) => value))

const customInputStyle: React.CSSProperties = {
  marginLeft: 30,
}

const RacesSelector: React.FC<Props> = config.isRaceEnabled ? (props): React.ReactElement => {
  const {gender, values, onChange} = props
  const {t} = useTranslation('translation')
  const hadEmptyValue = !!values?.includes('')

  // Custom value.
  const customInputRef = useRef<Inputable>(null)
  const customValue = values?.find(value => !existingOptions.has(value)) || undefined
  const [isEditingCustomValue, setIsEditingCustomValue] = useState(false)
  const handleCustomValueFocus = useCallback(() => {
    if (hadEmptyValue) {
      onChange([])
    }
    setIsEditingCustomValue(true)
  }, [hadEmptyValue, onChange])
  const handleCustomValueBlur = useCallback(() => setIsEditingCustomValue(false), [])
  const handleChangeCustomValue = useCallback((customValue: string) => {
    const existingValues = (values || []).filter(value => !!value && existingOptions.has(value))
    if (!customValue) {
      onChange(existingValues)
      return
    }
    onChange([...existingValues, customValue])
  }, [onChange, values])
  const handleCustomCheckboxClick = useCallback(() => {
    if (isEditingCustomValue || customValue) {
      // Unchecking the box.
      onChange((values || []).filter(value => existingOptions.has(value)))
      return
    }
    customInputRef.current?.focus()
  }, [customValue, isEditingCustomValue, onChange, values])

  const handleChange = useCallback((values: readonly string[]): void => {
    if (!values.includes('') || values.length <= 1) {
      // No contradicting values.
      onChange(values)
      return
    }
    if (hadEmptyValue) {
      // User has just added a new value, remove the empty one.
      onChange(values.filter(value => value !== ''))
      return
    }
    // User has just added the empty value, remove all the other ones.
    onChange([''])
  }, [hadEmptyValue, onChange])
  return <React.Fragment>
    <CheckboxList
      options={localizeOptions(t, RACE_OPTIONS, {context: gender})}
      values={values}
      onChange={handleChange} />
    <div>
      <LabeledToggle
        type="checkbox" isSelected={isEditingCustomValue || !!customValue}
        onClick={handleCustomCheckboxClick}
        label={t('décrite par moi-même ci-dessous\u00A0:')} />
      <Input
        ref={customInputRef} value={customValue} style={customInputStyle}
        placeholder={t('Autre…')} onChangeDelayMillisecs={1000}
        onFocus={handleCustomValueFocus} name="race"
        onChange={handleChangeCustomValue} onBlur={handleCustomValueBlur} />
    </div>
  </React.Fragment>
} : () => null

export default React.memo(RacesSelector)
