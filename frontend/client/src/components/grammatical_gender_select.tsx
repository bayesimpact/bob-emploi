import React, {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {localizeOptions, prepareT} from 'store/i18n'
import {GENDER_OPTIONS} from 'store/user'

import {OneField} from 'components/field_set'
import type {Inputable} from 'components/input'
import Input from 'components/input'
import type {Focusable} from 'components/radio_button'
import RadioButton from 'components/radio_button'
import RadioGroup from 'components/radio_group'
import SameAdviceTooltip, {Content as SameAdvice} from 'components/same_advice_tooltip'
import {SmoothTransitions} from 'components/theme'

// This file uses "translation" ns (instead of "components") as it's using some translations
// prepared in the store.
// i18next-extract-mark-ns-start translation

const GRAMMATICAL_GENDER_OPTIONS = [
  {name: prepareT('féminin'), value: 'FEMININE'},
  {name: prepareT('masculin'), value: 'MASCULINE'},
  {name: prepareT('neutre'), value: 'UNKNOWN_GENDER'},
] as const

interface Props {
  customGender?: string
  gender?: bayes.bob.Gender
  isGenderNeeded?: boolean
  isQuestion?: boolean
  isValidated?: boolean
  onChange: (gender: bayes.bob.Gender) => void
  onCustomGenderChange: (customGender: string) => void
  radioGroupStyle?: React.CSSProperties
}

const detailsStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: '.9em',
  fontStyle: 'italic',
  marginTop: 5,
}

const GrammaticalGenderSelect = (props: Props, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {customGender, gender, isGenderNeeded, isQuestion, isValidated, onChange,
    onCustomGenderChange, radioGroupStyle} = props
  const {t} = useTranslation('translation')
  const [isGenderNoticeShown, setIsGenderNoticeShown] = useState(false)
  const isGrammaticalGenderQuestionShown = !!customGender

  const handleChangeSimpleGender = useCallback((gender: bayes.bob.Gender): void => {
    onCustomGenderChange('')
    onChange(gender)
  }, [onCustomGenderChange, onChange])
  const hasCustomGender = !!customGender
  useEffect((): void => {
    if (hasCustomGender) {
      setIsGenderNoticeShown(true)
    }
  }, [hasCustomGender])
  const customGenderInput = useRef<Inputable>(null)
  const [isGenderInputFocused, setIsGenderInputFocused] = useState(false)
  const handleGenderInputFocus = useCallback(() => setIsGenderInputFocused(true), [])
  const handleGenderInputBlur = useCallback(() => setIsGenderInputFocused(false), [])
  const handleCustomGenderClick = useCallback(() => customGenderInput.current?.focus(), [])

  return <React.Fragment>
    <OneField
      label={t('Vous êtes\u00A0:')} invalidClassName=""
      tooltip={isGenderNoticeShown ? null : <SameAdviceTooltip>
        {isGenderNeeded ? t(
          "{{productName}} se sert de cette information uniquement pour savoir s'il faut " +
          'parler de vous au masculin, au féminin ou au neutre.',
          {productName: config.productName},
        ) : null}
      </SameAdviceTooltip>}
      isValid={!!gender} isValidated={isValidated}
      note={customGender || isGenderNoticeShown ?
        <div style={detailsStyle}><SameAdvice /></div> : null}>
      <RadioGroup<bayes.bob.Gender>
        style={radioGroupStyle} ref={ref}
        childStyle={{marginBottom: 0}}
        onChange={handleChangeSimpleGender}
        options={localizeOptions(t, GENDER_OPTIONS)}
        value={isGrammaticalGenderQuestionShown || isGenderInputFocused ? undefined : gender}>
        <span style={{alignItems: 'center', display: 'flex'}}>
          <RadioButton
            isSelected={!!customGender || isGenderInputFocused} onClick={handleCustomGenderClick} />
          <Input
            value={customGender} onChange={onCustomGenderChange}
            ref={customGenderInput} name="sex" autoComplete="sex"
            style={{marginLeft: 10, width: isGenderInputFocused ? 180 : 120, ...SmoothTransitions}}
            placeholder={isGenderInputFocused ? t('décrire moi-même') : ''}
            onFocus={handleGenderInputFocus} onBlur={handleGenderInputBlur}
            onChangeDelayMillisecs={1000} />
        </span>
      </RadioGroup>
    </OneField>
    {isGrammaticalGenderQuestionShown ? <OneField
      label={isQuestion ?
        t("Est-ce que vous préférez qu'on parle de vous au\u00A0:") :
        t("Vous préférez qu'on parle de vous au\u00A0:")}>
      <RadioGroup<bayes.bob.Gender>
        style={radioGroupStyle}
        onChange={onChange}
        options={localizeOptions(t, GRAMMATICAL_GENDER_OPTIONS)}
        value={gender} />
    </OneField> : null}
  </React.Fragment>
}

export default React.memo(React.forwardRef(GrammaticalGenderSelect))
