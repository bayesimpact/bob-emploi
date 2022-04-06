import CloseIcon from 'mdi-react/CloseIcon'
import React, {useCallback, useImperativeHandle, useLayoutEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import Button from 'components/button'
import type {Inputable} from 'components/input'
import Input from 'components/input'

type Style = React.CSSProperties | undefined


const splitExternalStyle = (style?: Style): [Style, Style] => {
  if (!style) {
    return [style, style]
  }
  const {
    alignSelf,
    margin,
    marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    ...otherStyleProps
  } = style
  return [
    {alignSelf, margin, marginBottom, marginLeft, marginRight, marginTop},
    otherStyleProps,
  ]
}


type Props = React.ComponentProps<typeof Input> & {
  defaultValue?: string
  onChange: (newValue: string) => void
  // Should never set a value, but used defaultValue and onChange.
  value?: never
}

const buttonStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 16px 7px',
  position: 'absolute',
  right: 6,
  top: '50%',
  transform: 'translateY(-50%)',
}
const clearButtonStyle: React.CSSProperties = {
  padding: 6,
  position: 'absolute',
  right: 6,
  top: '50%',
  transform: 'translateY(-50%)',
}


const ValidateInput = (props: Props, ref: React.Ref<Inputable>): React.ReactElement => {
  const {style, defaultValue, onChange, ...otherProps} = props
  const [externalStyle, otherStyle] = splitExternalStyle(style)
  const [value, setValue] = useState('')
  const input = useRef<Inputable>(null)
  const {t} = useTranslation('components')

  useImperativeHandle(ref, (): Inputable => ({
    blur: (): void => input.current?.blur(),
    focus: (): void => input.current?.focus(),
    select: (): void => input.current?.select(),
  }))

  useLayoutEffect((): void => {
    setValue(defaultValue || '')
  }, [defaultValue])

  const handleValidate = useCallback((): void => {
    input.current?.blur()
    onChange(value)
  }, [onChange, value])

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault()
    handleValidate()
  }, [handleValidate])

  const clear = useCallback((): void => {
    onChange('')
    input.current?.focus()
  }, [onChange])

  return <form style={{...externalStyle, position: 'relative'}} onSubmit={handleSubmit}>
    <Input style={otherStyle} {...otherProps} ref={input} value={value} onChange={setValue} />
    {value !== defaultValue ? <Button
      style={buttonStyle} onClick={handleValidate} isRound={true}
      aria-describedby={otherProps['aria-labelledby']}>
      {t('Valider')}
    </Button> : value ? <button
      onClick={clear} style={clearButtonStyle} aria-label={t('Effacer')} type="button"
      aria-describedby={otherProps['aria-labelledby']}>
      <CloseIcon aria-hidden={true} />
    </button> : null}
  </form>
}


export default React.memo(React.forwardRef(ValidateInput))
