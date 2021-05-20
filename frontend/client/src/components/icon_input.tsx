import {MdiReactIconProps} from 'mdi-react/dist/typings'
import React, {useMemo} from 'react'

import Input, {Inputable} from 'components/input'


interface Props extends React.ComponentProps<typeof Input> {
  iconComponent: React.ComponentType<MdiReactIconProps>
  iconStyle?: React.CSSProperties
  inputStyle?: React.CSSProperties
  position?: 'left' | 'right'
}


const IconInput = (props: Props, ref: React.Ref<Inputable>): React.ReactElement => {
  const {iconComponent, iconStyle, inputStyle, position = 'right', style, ...otherProps} = props
  const iconContainer = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: 'white',
    bottom: 0,
    color: colors.PINKISH_GREY,
    cursor: 'text',
    display: 'flex',
    fontSize: 20,
    margin: 1,
    paddingLeft: 5,
    paddingRight: 5,
    pointerEvents: 'none',
    position: 'absolute',
    [position]: 0,
    top: 0,
  }), [position])
  const finalInputStyle = useMemo((): React.CSSProperties => ({
    paddingRight: 30,
    ...inputStyle,
  }), [inputStyle])
  const Icon = iconComponent
  return <div style={{position: 'relative', ...style}}>
    <Input {...otherProps} ref={ref} style={finalInputStyle} />
    <span style={iconContainer}>
      <Icon style={iconStyle} />
    </span>
  </div>
}


export default React.memo(React.forwardRef(IconInput))
