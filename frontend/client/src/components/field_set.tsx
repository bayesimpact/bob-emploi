import type {TFunctionResult} from 'i18next'
import _uniqueId from 'lodash/uniqueId'
import CheckIcon from 'mdi-react/CheckIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import React, {useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import isMobileVersion from 'store/mobile'


interface FieldCheckProps {
  isMarkedInvalid?: boolean
  isValid?: boolean
  onCheckDescriptionId?: (id?: string) => void
  style?: React.CSSProperties
}


const fieldCheckIconStyle: React.CSSProperties = {
  fill: '#fff',
  width: 20,
}


const FieldCheckBase = (props: FieldCheckProps): React.ReactElement => {
  const {isMarkedInvalid, isValid, onCheckDescriptionId, style, ...otherProps} = props
  const {t} = useTranslation('components')
  const checkboxStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: isMarkedInvalid ? colors.RED_PINK : colors.GREENISH_TEAL,
    borderRadius: '50%',
    bottom: 0,
    color: '#fff',
    display: 'flex',
    fontSize: 16,
    height: isMobileVersion ? 20 : 30,
    justifyContent: 'center',
    margin: 'auto',
    opacity: (!isMobileVersion && isValid) || isMarkedInvalid ? 1 : 0,
    overflow: 'hidden',
    position: 'absolute',
    right: isMobileVersion ? 30 : -10,
    top: isMobileVersion ? -70 : 0,
    transform: 'translateX(100%)',
    width: isMobileVersion ? 20 : 30,
    ...style,
  }), [style, isValid, isMarkedInvalid])
  const descriptionId = useMemo(_uniqueId, [])
  useEffect(() => {
    if (!isMarkedInvalid && !isValid) {
      onCheckDescriptionId?.(undefined)
    } else {
      onCheckDescriptionId?.(descriptionId)
    }
  }, [descriptionId, isMarkedInvalid, isValid, onCheckDescriptionId])
  return <div style={checkboxStyle}>
    {isMarkedInvalid ? <CloseIcon
      style={fieldCheckIconStyle} role="img" aria-label={t('Erreur')}
      {...otherProps} id={descriptionId} /> :
      isValid ? <CheckIcon
        style={fieldCheckIconStyle} role="img" aria-label={t('Valide')}
        {...otherProps} id={descriptionId} /> : null}
  </div>
}
const FieldCheck = React.memo(FieldCheckBase)


interface FieldContainerProps {
  hasNoteOrComment?: boolean
  isInline?: boolean
  style?: React.CSSProperties
}


const makeContainerStyle = (
  {hasNoteOrComment, isInline, style}: FieldContainerProps): React.CSSProperties => ({
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  fontSize: 15,
  marginBottom: hasNoteOrComment || isInline ? 0 : 25,
  marginLeft: 0,
  marginRight: 0,
  minWidth: isInline ? 'initial' : isMobileVersion ? '100%' : 360,
  padding: 0,
  position: 'relative',
  ...style,
})


interface Props extends FieldContainerProps {
  // TODO(pascal): Clean up fieldsets using only one element and switch this to only accept multiple
  // children and force a legend.
  children: NonNullable<React.ReactNode>
  isValid?: boolean
  isValidated?: boolean
  legend?: string | TFunctionResult
  tooltip?: React.ReactElement<{'aria-describedby'?: string}> | null
}


const fieldSetStyle: React.CSSProperties = {
  position: 'relative',
}
const extendedLabelStyle: React.CSSProperties = {
  color: colors.COOL_GREY,
  fontSize: '90%',
  fontStyle: 'italic',
  margin: '0 0 11px',
}
const legendStyle: React.CSSProperties = {
  marginBottom: 15,
}


const FieldSet = (props: Props): React.ReactElement => {
  const {children, hasNoteOrComment, isInline, isValid,
    isValidated, legend, style, tooltip, ...otherProps} = props
  const isMarkedInvalid = isValidated && !isValid
  const containerStyle = useMemo(
    (): React.CSSProperties => makeContainerStyle({hasNoteOrComment, isInline, style}),
    [isInline, hasNoteOrComment, style],
  )
  // TODO(pascal): Fix the tooltip in legend for a11y.
  const legendId = useMemo(_uniqueId, [])
  return <fieldset
    className={isMarkedInvalid ? 'marked-invalid' : ''}
    style={containerStyle}
    {...otherProps}>
    {legend ? <legend style={legendStyle}>
      {legend}
      {tooltip && React.cloneElement(tooltip, {'aria-describedby': legendId})}
    </legend> : null}
    <div style={fieldSetStyle}>
      <div>
        {children}
      </div>
      {isMarkedInvalid ?
        <FieldCheck isValid={isValid} isMarkedInvalid={isMarkedInvalid} /> : null}
    </div>
  </fieldset>
}

const makeIdList = (id1?: string, id2?: string): string|undefined => {
  if (!id1) {
    return id2
  }
  if (!id2) {
    return id1
  }
  return `${id1} ${id2}`
}


interface OneFieldProps extends FieldContainerProps {
  children: React.ReactElement<{
    'aria-describedby'?: string
    'aria-invalid': boolean
    'aria-labelledby'?: string
  }>
  extendedLabel?: React.ReactNode
  hasCheck?: boolean
  invalidClassName?: string
  isValid?: boolean
  isValidated?: boolean
  label: string | TFunctionResult
  note?: React.ReactElement<{id?: string}> | null
  tooltip?: React.ReactElement<{'aria-describedby'?: string}> | null
}

const noPStyle: React.CSSProperties = {
  display: 'inline',
  margin: 0,
}


const OneFieldBase = (props: OneFieldProps): React.ReactElement => {
  const {children, extendedLabel, hasCheck, hasNoteOrComment, invalidClassName = 'marked-invalid',
    isInline, isValid, isValidated, label, note, style, tooltip, ...otherProps} = props
  const isMarkedInvalid = isValidated && !isValid
  const containerStyle = useMemo(
    (): React.CSSProperties => makeContainerStyle({hasNoteOrComment, isInline, style}),
    [isInline, hasNoteOrComment, style],
  )

  const labelStyle = useMemo((): React.CSSProperties => ({
    color: isInline && isMarkedInvalid ? colors.RED_PINK : colors.CHARCOAL_GREY,
    fontSize: style && style.fontSize || 15,
    lineHeight: 1.3,
    margin: isInline ? 0 : '0 0 11px',
  }), [style, isInline, isMarkedInvalid])

  const child = React.Children.only(children)

  const labelId = useMemo(_uniqueId, [])
  const noteId = useMemo(_uniqueId, [])
  const [descriptionId, setDescriptionId] = useState<undefined|string>()

  return <div
    className={isMarkedInvalid ? invalidClassName : ''}
    style={containerStyle}
    {...otherProps}>
    <div style={labelStyle}>
      <p style={noPStyle} id={labelId}>{label}</p>
      {tooltip && React.cloneElement(tooltip, {'aria-describedby': labelId})}
    </div>
    {extendedLabel ? <p style={extendedLabelStyle} aria-describedby={labelId}>
      {extendedLabel}</p> : null}
    <div style={fieldSetStyle}>
      <div>
        {React.cloneElement(child, {
          'aria-describedby': makeIdList(
            makeIdList(descriptionId, child.props['aria-describedby']),
            note && noteId || undefined),
          'aria-invalid': isMarkedInvalid,
          'aria-labelledby': makeIdList(labelId, child.props['aria-labelledby']),
        })}
        {note ? React.cloneElement(note, {id: noteId}) : null}
      </div>
      {(hasCheck && isValid) || isMarkedInvalid ?
        <FieldCheck
          onCheckDescriptionId={setDescriptionId} isValid={isValid}
          isMarkedInvalid={isMarkedInvalid} /> : null}
    </div>
  </div>
}
export const OneField = React.memo(OneFieldBase)


export default React.memo(FieldSet)
