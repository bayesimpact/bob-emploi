import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronUpIcon from 'mdi-react/ChevronUpIcon'
import MenuDownIcon from 'mdi-react/MenuDownIcon'
import MenuUpIcon from 'mdi-react/MenuUpIcon'
import type {MdiReactIconProps} from 'mdi-react/dist/typings'
import React, {useMemo} from 'react'


interface Props extends MdiReactIconProps {
  icon: 'chevron' | 'menu'
  isUp?: boolean
}


const UpDownIcon = (props: Props): React.ReactElement => {
  const {icon, isUp, ...otherProps} = props

  const Icon = useMemo((): React.ComponentType<MdiReactIconProps> => {
    if (icon === 'chevron') {
      return isUp ? ChevronUpIcon : ChevronDownIcon
    }
    return isUp ? MenuUpIcon : MenuDownIcon
  }, [icon, isUp])
  return <Icon role="img" {...otherProps} />
}


export default React.memo(UpDownIcon)
