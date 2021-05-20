import CheckIcon from 'mdi-react/CheckIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import isMobileVersion from 'store/mobile'


interface FieldCheckProps {
  isMarkedInvalid?: boolean
  isValid?: boolean
  style?: React.CSSProperties
}


const fieldCheckIconStyle: React.CSSProperties = {
  fill: '#fff',
  width: 20,
}


const FieldCheckBase = (props: FieldCheckProps): React.ReactElement => {
  const {isMarkedInvalid, isValid, style} = props
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
  return <div style={checkboxStyle}>
    {isMarkedInvalid ? <CloseIcon style={fieldCheckIconStyle} /> : null}
    {isValid ? <CheckIcon style={fieldCheckIconStyle} /> : null}
  </div>
}
FieldCheckBase.propTypes = {
  isMarkedInvalid: PropTypes.bool,
  isValid: PropTypes.bool,
  style: PropTypes.object,
}
const FieldCheck = React.memo(FieldCheckBase)


interface FieldSetProps {
  children: React.ReactNode
  disabled?: boolean
  hasCheck?: boolean
  hasNoteOrComment?: boolean
  isInline?: boolean
  isValid?: boolean
  isValidated?: boolean
  label?: React.ReactNode
  style?: React.CSSProperties
}


const fieldSetStyle: React.CSSProperties = {
  position: 'relative',
}


const FieldSet = (props: FieldSetProps): React.ReactElement => {
  const {children, disabled, hasCheck, hasNoteOrComment, isInline, isValid, isValidated, label,
    style, ...otherProps} = props
  const isMarkedInvalid = !disabled && isValidated && !isValid
  const containerStyle = useMemo((): React.CSSProperties => ({
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    fontSize: 15,
    marginBottom: hasNoteOrComment || isInline ? 0 : 25,
    marginLeft: 0,
    marginRight: 0,
    minWidth: isInline ? 'initial' : isMobileVersion ? '100%' : 360,
    opacity: disabled ? 0.5 : 'inherit',
    padding: 0,
    position: 'relative',
    ...style,
  }), [disabled, isInline, hasNoteOrComment, style])

  const labelStyle = useMemo((): React.CSSProperties => ({
    color: isInline && isMarkedInvalid ? colors.RED_PINK : colors.CHARCOAL_GREY,
    fontSize: style && style.fontSize || 15,
    lineHeight: 1.3,
    marginBottom: isInline ? 0 : 11,
  }), [style, isInline, isMarkedInvalid])

  return <fieldset
    style={containerStyle} disabled={disabled}
    className={isMarkedInvalid ? 'marked-invalid' : ''}
    {...otherProps}>
    <label style={labelStyle}>{label}</label>
    <div style={fieldSetStyle}>
      <div>
        {children}
      </div>
      {(hasCheck && isValid) || isMarkedInvalid ?
        <FieldCheck isValid={isValid} isMarkedInvalid={isMarkedInvalid} /> : null}
    </div>
  </fieldset>
}
FieldSet.propTypes = {
  children: PropTypes.node,
  // We keep disabled by consistency with the DOM fieldset element.
  // eslint-disable-next-line react/boolean-prop-naming
  disabled: PropTypes.bool,
  hasCheck: PropTypes.bool,
  hasNoteOrComment: PropTypes.bool,
  isInline: PropTypes.bool,
  isValid: PropTypes.bool,
  isValidated: PropTypes.bool,
  label: PropTypes.node,
  style: PropTypes.object,
}


export default React.memo(FieldSet)
