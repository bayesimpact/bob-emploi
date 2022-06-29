import _memoize from 'lodash/memoize'
import type {TFunction} from 'i18next'
import i18next from 'i18next'
import React, {useCallback, useImperativeHandle, useMemo, useRef} from 'react'
import type {AriaGuidanceProps, AriaLiveMessages, AriaOnChangeProps, AriaOnFilterProps,
  AriaOnFocusProps, GroupBase, Props as ReactSelectProps, SelectInstance} from 'react-select'
import ReactSelect from 'react-select'
import {useTranslation} from 'react-i18next'

import type {WithLocalizableName} from 'store/i18n'
import isMobileVersion from 'store/mobile'

const getName = ({name}: {name: string}): string => name
const getIsDisabled = ({disabled}: {disabled?: boolean}): boolean => !!disabled


export interface SelectOption<T = string> {
  disabled?: boolean
  name: string
  value: T
}

export interface Focusable {
  focus(): void
}


export type LocalizedSelectOption<T> = Omit<SelectOption<T>, 'name'> & WithLocalizableName


interface SelectProps<T, O = SelectOption<T>> extends
  Omit<ReactSelectProps<O, false>, 'onChange'|'value'|'options'> {
  areUselessChangeEventsMuted?: boolean
  // Number of options to scroll the menu when first opened.
  defaultMenuScroll?: number
  isSearchableOnMobile?: boolean
  onChange: (value: T) => void
  options: readonly O[]
  style?: React.CSSProperties
  value?: T
}


const translateAriaLiveMessages = _memoize(
  (t: TFunction): AriaLiveMessages<unknown, false, GroupBase<unknown>> => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
    const addArrayIndex = <T extends unknown>(
      label: string, arr: readonly T[] | undefined, item: T): string => {
      if (!arr || arr.length < 2) {
        return label
      }
      return t(
        '{{label}}, {{index}} sur {{totalCount}}.',
        {index: arr.indexOf(item) + 1, label, totalCount: arr.length})
    }

    return {
      guidance: (props: AriaGuidanceProps) => {
        const {isSearchable, isDisabled, tabSelectsValue, context} = props
        switch (context) {
          case 'menu': {
            const optionalEnter = isDisabled ? '' :
              t(", appuyez sur Entrée pour sélectionner l'option en cours")
            const optionalTab = tabSelectsValue ?
              t(", appuyez sur Tab pour sélectionner l'option et quitter le menu") : ''
            return t(
              'Utilisez les flèches haut et bas pour choisir une option{{optionalEnter}}, ' +
              'appuyez sur Échap pour quitter le menu{{optionalTab}}.',
              {optionalEnter, optionalTab})
          }
          case 'input': {
            const select = props['aria-label'] || 'Menu de sélection'
            const optionalSearchable = isSearchable ?
              t(', ou commencez à taper pour chercher parmi les options') : ''
            return t(
              '{{select}}, appuyez sur la flèche bas pour ouvrir le menu{{optionalSearchable}}.',
              {optionalSearchable, select})
          }
          case 'value':
            return t(
              'Utilisez les flèches gauche et droite pour basculer entre les différentes ' +
              "options, utilisez la touche retour arrière pour retirer l'option en cours de la " +
              'sélection.')
        }
      },
      onChange: (props: AriaOnChangeProps<unknown, false>) => {
        const {action, label = '', labels, isDisabled} = props
        switch (action) {
          case 'deselect-option':
          case 'pop-value':
          case 'remove-value':
            return t('option {{label}} déselectionnée', {label})
          case 'clear':
            return t('Toutes les options séleectionnées ont été retirées')
          case 'initial-input-focus':
            if (!labels.length) {
              return ''
            }
            return t(
              'option {{labels}} sélectionnée', {count: labels.length, labels: labels.join(', ')})
          case 'select-option':
            return isDisabled ?
              t("L'option {{label}} n'est pas disponible. Choisissez une autre option.", {label}) :
              t("L'option {{label}} est sélectionnée.", {label})
          default:
            return ''
        }
      },
      onFilter: (props: AriaOnFilterProps) => {
        const {inputValue, resultsMessage} = props
        if (!inputValue) {
          if (!resultsMessage) {
            return ''
          }
          return t('{{resultsMessage}}.', {resultsMessage})
        }
        return t(
          '{{resultsMessage}} pour la recherche sur "{{inputValue}}".',
          {inputValue, resultsMessage})
      },
      onFocus: (props: AriaOnFocusProps<unknown, GroupBase<unknown>>) => {
        const {
          context,
          focused,
          options,
          label = '',
          selectValue,
          isDisabled,
          isSelected,
        } = props

        if (context === 'value' && selectValue) {
          return addArrayIndex(label, selectValue, focused)
        }

        if (context === 'menu') {
          return addArrayIndex(
            label +
            (isSelected ? t(' (option sélectionnée)') : '') +
            (isDisabled ? t(' (option non disponible)') : ''),
            options, focused)
        }
        return ''
      },
    }
  },
  (): string => i18next.language,
)


const translateResultsAvailable = _memoize(
  (t: TFunction) =>
    ({count}: {count: number}): string => t('{{count}} résultat disponible', {count}),
  (): string => i18next.language,
)


const Select = <
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
  T extends unknown = string, OptionType extends SelectOption<T> = SelectOption<T>
>(props: SelectProps<T, OptionType>, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {areUselessChangeEventsMuted = true, defaultMenuScroll, isSearchableOnMobile,
    onChange, options, style, value, ...otherProps} = props

  const {t: translate} = useTranslation('components')

  const handleChange = useCallback(
    (option?: SelectOption<T>|null): void => {
      if (!option) {
        return
      }
      const {value: newValue} = option
      if (!areUselessChangeEventsMuted || (newValue !== value)) {
        onChange(newValue)
      }
    },
    [areUselessChangeEventsMuted, onChange, value],
  )

  const subComponent = useRef<SelectInstance<OptionType, false>>(null)

  useImperativeHandle(ref, (): Focusable => ({focus: () => subComponent.current?.focus()}))

  const handleMenuOpen = useCallback((): void => {
    const select = subComponent.current
    if (!select) {
      return
    }
    // Either focus on the value or the defaultMenuScroll.
    const focusedOption = value &&
      options.findIndex(({value: thisValue}): boolean => value === thisValue) + 1 || 1 - 1 ||
      defaultMenuScroll
    if (!focusedOption) {
      return
    }
    window.setTimeout((): void => {
      // Hack to have the desired element at the start of the menu page.
      select.setState(
        {focusedOption: options[focusedOption - 1]},
        (): void => {
          select.focusOption('pagedown')
        },
      )
    })
  }, [defaultMenuScroll, options, value])

  const valueProp = useMemo(
    (): OptionType | undefined =>
      options.find(({value: optionValue}): boolean => value === optionValue),
    [options, value])

  const selectStyle = {
    color: colors.CHARCOAL_GREY,
    height: 41,
    lineHeight: 1.5,
    width: '100%',
    ...style,
  }
  return <ReactSelect<OptionType, false>
    ariaLiveMessages={translateAriaLiveMessages(translate)}
    screenReaderStatus={translateResultsAvailable(translate)}
    onChange={handleChange}
    value={valueProp}
    getOptionLabel={getName}
    isOptionDisabled={getIsDisabled}
    isSearchable={isSearchableOnMobile || !isMobileVersion}
    styles={{
      container: (base) => ({...base, ...selectStyle}),
      control: (base, {isFocused}) => ({
        ...base,
        '&:hover': {
          ...base['&:hover'] as typeof base,
          borderColor: isFocused ? colors.BOB_BLUE : colors.COOL_GREY,
        },
        'borderColor': isFocused ? colors.BOB_BLUE : colors.SILVER,
        'borderRadius': 0,
        'boxShadow': 'initial',
        'height': selectStyle.height,
      }),
      option: (base, {isDisabled, isFocused, isSelected}) => ({
        ...base,
        ...isFocused && !isSelected && !isDisabled ? {
          backgroundColor: colors.BOB_BLUE_HOVER,
        } : undefined,
        ...isSelected && !isDisabled ? {
          backgroundColor: colors.BOB_BLUE,
          color: '#fff',
        } : undefined,
        ':active': {
          ...base[':active'],
          ...isSelected && !isDisabled ? {
            backgroundColor: colors.BOB_BLUE,
          } : undefined,
          ...!isSelected && !isDisabled ? {
            backgroundColor: colors.BOB_BLUE_ACTIVE,
          } : undefined,
        },
      }),
      placeholder: (base) => ({
        ...base,
        color: colors.COOL_GREY,
      }),
    }}
    options={options}
    onMenuOpen={handleMenuOpen}
    ref={subComponent}
    {...otherProps} />
}


const typedMemo: <T>(c: T) => T = React.memo


export default typedMemo(React.forwardRef(Select))
