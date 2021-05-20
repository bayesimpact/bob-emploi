import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronUpIcon from 'mdi-react/ChevronUpIcon'
import MenuDownIcon from 'mdi-react/MenuDownIcon'
import MenuUpIcon from 'mdi-react/MenuUpIcon'
import {MdiReactIconProps} from 'mdi-react/dist/typings'
import PropTypes from 'prop-types'
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
  return <Icon {...otherProps} />
}
UpDownIcon.propTypes = {
  icon: PropTypes.oneOf(['chevron', 'menu']).isRequired,
  isUp: PropTypes.bool,
}


export default React.memo(UpDownIcon)
