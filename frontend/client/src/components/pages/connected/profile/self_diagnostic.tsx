import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import PropTypes from 'prop-types'

import isMobileVersion from 'store/mobile'
import {useSafeDispatch, useAsynceffect} from 'store/promise'
import {DispatchAllActions, RootState, diagnoseOnboarding,
  getDiagnosticMainChallenges} from 'store/actions'

import useFocusableRefAs, {Focusable} from 'hooks/focus'

import CircularProgress from 'components/circular_progress'
import Emoji from 'components/emoji'
import Trans from 'components/i18n_trans'
import ValidateInput from 'components/validate_input'
import Markdown from 'components/markdown'
import {useRadioGroup} from 'components/radio_group'
import {useHoverAndFocus} from 'components/radium'

import {ProjectStepProps, Step} from './step'

interface MainChallengeButtonProps {
  index: number
  isSelected: boolean
  onBlur?: () => void
  onClick: (value: ValidMainChallenge) => void
  onFocus: (index: number) => void
  style?: React.CSSProperties
  tabIndex?: number
  value: ValidMainChallenge
}

const computeButtonStyle = (isHighlighted: boolean, isSelected: boolean): React.CSSProperties => ({
  alignItems: 'center',
  backgroundColor: isSelected ? colors.BOB_BLUE :
    isHighlighted ? colors.MODAL_PROJECT_GREY : 'transparent',
  border: `1px solid ${isSelected ? colors.BOB_BLUE : colors.FOOTER_GREY}`,
  borderRadius: 25,
  color: isSelected ? '#fff' : colors.DARK_TWO,
  display: 'flex',
  minHeight: 44,
  padding: '0 15px',
  ...(isSelected ? {fontWeight: 'bold'} : undefined),
})

const emojiStyle: React.CSSProperties = {
  marginLeft: 3,
  marginRight: 13,
}

const MainChallengeButtonBase = (
  props: MainChallengeButtonProps, ref?: React.Ref<Focusable>,
): React.ReactElement => {
  const {index, isSelected, onBlur, onClick, onFocus, style, value, tabIndex} = props
  const handleFocus = useCallback((): void => onFocus(index), [onFocus, index])
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus({onBlur, onFocus: handleFocus})
  const handleClick = useCallback((): void => onClick(value), [onClick, value])
  const isHighlighted = isFocused || isHovered
  const containerStyle = useMemo((): React.CSSProperties => ({
    ...computeButtonStyle(isHighlighted, isSelected),
    fontSize: 14,
    ...style,
  }), [isHighlighted, isSelected, style])
  return <button
    ref={useFocusableRefAs(ref)} {...handlers} onClick={handleClick} style={containerStyle}
    tabIndex={tabIndex}>
    {value.emoji ? <Emoji style={emojiStyle} size={22}>{value.emoji}</Emoji> : undefined}
    <Markdown content={value.description} isSingleLine={true} />
  </button>
}
const MainChallengeButton = React.memo(React.forwardRef(MainChallengeButtonBase))


interface CustomDiagnosticProps {
  index: number
  isSelected: boolean
  onBlur?: () => void
  onChange?: (value: string) => void
  onClick?: () => void
  onFocus: (index: number) => void
  tabIndex?: number
  value?: string
}

const CustomDiagnosticBase = (
  props: CustomDiagnosticProps, ref?: React.Ref<Focusable>,
): React.ReactElement => {
  const {index, isSelected, onBlur, onChange, onClick, onFocus, tabIndex, value} = props
  const {t} = useTranslation()

  const handleFocus = useCallback((): void => onFocus(index), [onFocus, index])
  const {isFocused, isHovered, ...handlers} = useHoverAndFocus({onBlur, onFocus: handleFocus})
  const isHighlighted = isFocused || isHovered

  const handleChange = useCallback(
    (value: string): void => onChange?.(value),
    [onChange],
  )

  const containerStyle = useMemo(
    (): React.CSSProperties =>
      computeButtonStyle(isHighlighted, isSelected && !isFocused),
    [isFocused, isHighlighted, isSelected],
  )

  return <ValidateInput
    defaultValue={value} style={containerStyle} ref={useFocusableRefAs(ref)} onClick={onClick}
    placeholder={t('Autre…')}
    onChange={handleChange} {...handlers} tabIndex={tabIndex} />
}
const CustomDiagnostic = React.memo(React.forwardRef(CustomDiagnosticBase))


interface SelfDiagnosticProps {
  onChange: (value: bayes.bob.SelfDiagnostic) => void
  value: bayes.bob.SelfDiagnostic
}


const challengeButtonStyle: React.CSSProperties = {
  marginBottom: 15,
  width: '100%',
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
    value: {categoryId = '', categoryDetails = '', status},
  } = props

  const [options, setOptions] = useState<undefined|readonly ValidMainChallenge[]>(undefined)
  const [answeredInOrder, setIsSorted] = useState<undefined|bayes.OptionalBool>(undefined)
  const {i18n, t} = useTranslation()
  const locale = useSelector(({user: {profile: {
    locale = i18n.language,
  } = {}}}: RootState): string => locale)

  useAsynceffect(async (checkIfCanceled) => {
    const response = await dispatch(getDiagnosticMainChallenges(locale))
    if (!response || checkIfCanceled()) {
      return
    }
    setIsSorted(response.isSorted)
    setOptions([...(response.categories || []).
      filter((c: bayes.bob.DiagnosticMainChallenge): c is ValidMainChallenge => !!c.categoryId),
    {
      categoryId: 'UNDEFINED_SELF_DIAGNOSTIC',
      description: t('Je ne sais pas'),
    }])
  }, [dispatch, locale, t])

  const selfDiagnostic = categoryId || status
  const handleChangeDiagnostic = useCallback(({categoryId}: ValidMainChallenge): void => {
    if (categoryId === 'UNDEFINED_SELF_DIAGNOSTIC') {
      onChange({answeredInOrder, status: categoryId})
      return
    }
    onChange({answeredInOrder, categoryId, status: 'KNOWN_SELF_DIAGNOSTIC'})
  }, [answeredInOrder, onChange])

  const handleChangeCustomDiagnostic = useCallback((categoryDetails: string): void => {
    onChange({answeredInOrder, categoryDetails, status: 'OTHER_SELF_DIAGNOSTIC'})
  }, [answeredInOrder, onChange])

  const isOtherSelfDiagnostic = status === 'OTHER_SELF_DIAGNOSTIC'
  const handleCustomDiagnosticClick = useCallback((): void => {
    if (!isOtherSelfDiagnostic) {
      onChange({answeredInOrder, status: 'OTHER_SELF_DIAGNOSTIC'})
    }
  }, [answeredInOrder, isOtherSelfDiagnostic, onChange])

  const selectedIndex = isOtherSelfDiagnostic ?
    (options?.length || 0) :
    (options || []).findIndex(({categoryId}) => categoryId === selfDiagnostic)
  const {childProps, containerProps} =
    useRadioGroup<HTMLDivElement>((options?.length || 0) + 1, selectedIndex)

  if (!options) {
    return <div style={progressContainerStyle}>
      <CircularProgress size={60} thickness={2} />
    </div>
  }

  return <div {...containerProps}>
    {options.map((mainChallenge, index) => <MainChallengeButton
      key={mainChallenge.categoryId} value={mainChallenge}
      onClick={handleChangeDiagnostic} style={challengeButtonStyle}
      {...childProps(index)}
    />)}
    <CustomDiagnostic
      value={categoryDetails}
      onClick={handleCustomDiagnosticClick}
      onChange={handleChangeCustomDiagnostic}
      {...childProps(options.length)} />
  </div>
}
const SelfDiagnostic = React.memo(SelfDiagnosticBase)


const lateTitleStyle: React.CSSProperties = {
  color: '#000',
  fontSize: 20,
  marginTop: isMobileVersion ? 10 : 30,
}


const SelfDiagnosticStepBase = (props: ProjectStepProps): React.ReactElement => {
  const {
    featuresEnabled: {lateSelfDiagnostic} = {},
    newProject: {originalSelfDiagnostic = {}} = {},
    onSubmit,
    t,
    totalStepCount,
  } = props
  const isLateSelfDiagnostic = lateSelfDiagnostic === 'ACTIVE'

  const dispatch = useDispatch<DispatchAllActions>()

  const handleChange = useCallback((originalSelfDiagnostic: bayes.bob.SelfDiagnostic): void => {
    dispatch(diagnoseOnboarding({projects: [{originalSelfDiagnostic}]}))
  }, [dispatch])

  const isFormValid = originalSelfDiagnostic.status &&
    (originalSelfDiagnostic.status !== 'KNOWN_SELF_DIAGNOSTIC' ||
      !!originalSelfDiagnostic.categoryId) &&
    (originalSelfDiagnostic.status !== 'OTHER_SELF_DIAGNOSTIC' ||
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
      {categoryId: 'stuck-market', status: 'KNOWN_SELF_DIAGNOSTIC'})
  }, [isFormValid, handleChange, handleSubmit])


  const explanation = isLateSelfDiagnostic ? <Trans style={lateTitleStyle}>
    Quelle est, selon vous, <strong>la plus grande priorité</strong> de votre recherche
    d'emploi&nbsp;?
  </Trans> : t(
    "Quel est, selon vous, votre plus grand défi dans votre retour à l'emploi\u00A0?")

  return <Step
    title={isLateSelfDiagnostic ? undefined : t('Votre grand défi')}
    explanation={explanation}
    fastForward={fastForward}
    onNextButtonClick={isFormValid ? handleSubmit : undefined}
    nextButtonContent={isLateSelfDiagnostic ?
      t("Découvrir l'avis de {{productName}}", {productName: config.productName}) : undefined}
    {...props} totalStepCount={isLateSelfDiagnostic ? 0 : totalStepCount}>
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
      status: PropTypes.string.isRequired,
    }),
  }).isRequired,
  onSubmit: PropTypes.func.isRequired,
}
const SelfDiagnosticStep = React.memo(SelfDiagnosticStepBase)

// TODO(pascal): Use SelfDiagnostic in RER pages.
export {SelfDiagnostic, SelfDiagnosticStep}
