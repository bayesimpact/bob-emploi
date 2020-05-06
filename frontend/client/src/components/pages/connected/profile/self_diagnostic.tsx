import React, {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import PropTypes from 'prop-types'

import {useSafeDispatch} from 'store/promise'
import {DispatchAllActions, RootState, diagnoseOnboarding,
  getDiagnoticCategories} from 'store/actions'

import {Trans} from 'components/i18n'
import {CircularProgress, Input, Inputable, Markdown, RadioButton,
  RadioGroup} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'

import {ProjectStepProps, Step} from './step'

type ValidCategory = bayes.bob.DiagnosticCategory & {categoryId: string}

interface SelectOption {
  name: React.ReactNode
  value: string
}

interface CustomDiagnosticProps {
  isSelected: boolean
  onChange?: (value: string) => void
  onClick?: () => void
  value?: string
}

const customDiagnosticStyle = {
  alignItems: 'center',
  display: 'flex',
  marginBottom: 10,
  width: '100%',
} as const

const inputStyle = {
  flex: 1,
  height: 35,
  marginLeft: 10,
  width: 'initial',
}

const CustomDiagnosticBase = (props: CustomDiagnosticProps): React.ReactElement => {
  const {isSelected, onChange, onClick, value} = props
  const {t} = useTranslation()

  const input = useRef<Inputable>(null)
  const handleChange = useCallback(
    (value: string): void => onChange?.(value),
    [onChange],
  )
  const handleClick = useCallback((): void => input.current?.focus(), [])

  return <div style={customDiagnosticStyle}>
    <RadioButton onClick={handleClick} isSelected={isSelected} />
    <Input
      value={value} style={inputStyle} ref={input}
      onFocus={onClick}
      placeholder={t('Autre…')} onChangeDelayMillisecs={1000}
      onChange={handleChange} />
  </div>
}
CustomDiagnosticBase.propTypes = {
  isSelected: PropTypes.bool,
  onChange: PropTypes.func,
  onClick: PropTypes.func,
  value: PropTypes.string,
}
const CustomDiagnostic = React.memo(CustomDiagnosticBase)


interface SelfDiagnosticProps {
  onChange: (value: bayes.bob.SelfDiagnostic) => void
  value: bayes.bob.SelfDiagnostic
}


const radioGroupStyle: React.CSSProperties = {
  flexDirection: 'column',
}
const progressContainerStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  // Approximate size of the list of options once it's loaded.
  height: 260,
  justifyContent: 'center',
}


const SelfDiagnosticBase = (props: SelfDiagnosticProps): React.ReactElement => {
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const {
    onChange,
    value: {categoryId = '', categoryDetails = '', selfDiagnosticStatus},
  } = props

  const [options, setOptions] = useState<undefined|readonly SelectOption[]>(undefined)
  const locale = useSelector(({user: {profile: {locale = 'fr'} = {}}}: RootState): string => locale)

  useEffect((): void => {
    dispatch(getDiagnoticCategories()).
      then((response: readonly bayes.bob.DiagnosticCategory[]|void): void => {
        setOptions((response || []).
          filter((c: bayes.bob.DiagnosticCategory): c is ValidCategory => !!c.categoryId).
          map((category: ValidCategory): SelectOption => ({
            name: <Markdown content={category.description} isSingleLine={true} />,
            value: category.categoryId,
          })).concat([{
            name: <Trans parent="span">
              Je ne sais pas
            </Trans>,
            value: 'UNDEFINED_SELF_DIAGNOSTIC',
          }]),
        )
      })
  }, [dispatch, locale])

  const selfDiagnostic = categoryId || selfDiagnosticStatus
  const handleChangeDiagnostic = useCallback((categoryId: string): void => {
    if (categoryId === 'UNDEFINED_SELF_DIAGNOSTIC') {
      onChange({selfDiagnosticStatus: categoryId})
      return
    }
    onChange({categoryId, selfDiagnosticStatus: 'KNOWN_SELF_DIAGNOSTIC'})
  }, [onChange])

  const handleChangeCustomDiagnostic = useCallback((categoryDetails: string): void => {
    onChange({categoryDetails, selfDiagnosticStatus: 'OTHER_SELF_DIAGNOSTIC'})
  }, [onChange])

  const isOtherSelfDiagnostic = selfDiagnosticStatus === 'OTHER_SELF_DIAGNOSTIC'
  const handleCustomDiagnosticClick = useCallback((): void => {
    if (!isOtherSelfDiagnostic) {
      onChange({selfDiagnosticStatus: 'OTHER_SELF_DIAGNOSTIC'})
    }
  }, [isOtherSelfDiagnostic, onChange])

  if (!options) {
    return <div style={progressContainerStyle}>
      <CircularProgress size={60} thickness={2} />
    </div>
  }

  return <React.Fragment>
    <FieldSet isInline={true}>
      <RadioGroup<string>
        options={options}
        onChange={handleChangeDiagnostic}
        value={selfDiagnostic} style={radioGroupStyle} />
    </FieldSet>
    <CustomDiagnostic
      value={categoryDetails}
      isSelected={isOtherSelfDiagnostic}
      onClick={handleCustomDiagnosticClick}
      onChange={handleChangeCustomDiagnostic} />
  </React.Fragment>
}
const SelfDiagnostic = React.memo(SelfDiagnosticBase)


const SelfDiagnosticStepBase = (props: ProjectStepProps): React.ReactElement => {
  const {newProject: {originalSelfDiagnostic = {}} = {}, onSubmit, t} = props

  const dispatch = useDispatch<DispatchAllActions>()

  const handleChange = useCallback((originalSelfDiagnostic: bayes.bob.SelfDiagnostic): void => {
    dispatch(diagnoseOnboarding({projects: [{originalSelfDiagnostic}]}))
  }, [dispatch])

  const isFormValid = originalSelfDiagnostic.selfDiagnosticStatus &&
    (originalSelfDiagnostic.selfDiagnosticStatus !== 'KNOWN_SELF_DIAGNOSTIC' ||
      !!originalSelfDiagnostic.categoryId) &&
    (originalSelfDiagnostic.selfDiagnosticStatus !== 'OTHER_SELF_DIAGNOSTIC' ||
      !!originalSelfDiagnostic.categoryDetails)
  const handleSubmit = useCallback(
    (): void => void (isFormValid && onSubmit({originalSelfDiagnostic})),
    [isFormValid, onSubmit, originalSelfDiagnostic],
  )
  const fastForward = useCallback((): void => {
    if (isFormValid) {
      handleSubmit()
      return
    }
    handleChange(
      {categoryId: 'stuck-market', selfDiagnosticStatus: 'KNOWN_SELF_DIAGNOSTIC'})
  }, [isFormValid, handleChange, handleSubmit])


  const explanation = <Trans>
    Quel est, selon vous, votre plus grand défi dans votre retour à l'emploi&nbsp;?<br />
  </Trans>

  return <Step
    title={t('Votre grand défi')}
    explanation={explanation}
    fastForward={fastForward}
    onNextButtonClick={isFormValid ? handleSubmit : undefined}
    {...props}>
    <SelfDiagnostic
      value={originalSelfDiagnostic}
      onChange={handleChange} />
  </Step>
}
SelfDiagnosticStepBase.propTypes = {
  isShownAsStepsDuringOnboarding: PropTypes.bool,
  newProject: PropTypes.shape({
    originalSelfDiagnostic: PropTypes.shape({
      categoryDetails: PropTypes.string,
      categoryId: PropTypes.string,
      selfDiagnosticStatus: PropTypes.string.isRequired,
    }),
  }).isRequired,
  onSubmit: PropTypes.func.isRequired,
}
const SelfDiagnosticStep = React.memo(SelfDiagnosticStepBase)

// TODO(pascal): Use SelfDiagnostic in RER pages.
export {SelfDiagnostic, SelfDiagnosticStep}
