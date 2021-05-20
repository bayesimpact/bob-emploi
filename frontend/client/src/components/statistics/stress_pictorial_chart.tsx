import _memoize from 'lodash/memoize'
import HumanFemaleIcon from 'mdi-react/HumanFemaleIcon'
import HumanMaleIcon from 'mdi-react/HumanMaleIcon'
import HumanMaleFemaleIcon from 'mdi-react/HumanMaleFemaleIcon'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import isMobileVersion from 'store/mobile'

import {colorToAlpha} from 'components/colors'


interface Props {
  gender?: bayes.bob.Gender
  percent: number
  size?: number
  style?: React.CSSProperties
}


const captionStyle = _memoize((color): React.CSSProperties => ({
  color,
  flex: 'none',
  marginRight: 5,
}))
const stressPictorialCaptionRowStyle = {
  alignItems: 'center',
  display: 'flex',
  marginLeft: isMobileVersion ? 0 : 10,
  marginTop: 10,
}


const GOOD_COLOR = colorToAlpha(colors.GREENISH_TEAL, .5)

const YOU_COLOR = colors.BOB_BLUE

const BAD_COLOR = colorToAlpha(colors.RED_PINK, 5)

const StressPictorialChart: React.FC<Props> = (props: Props): React.ReactElement => {
  const {gender, percent, size = 300, style} = props
  const {t} = useTranslation()

  const lessStressedPercent = Math.round(100 - percent)
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'row',
    ...style,
  }), [style])
  const gridStyle = useMemo((): React.CSSProperties => ({
    direction: 'rtl',
    display: 'grid',
    gridGap: 1,
    gridTemplate: 'repeat(10, 1fr) / repeat(10, 1fr)',
    height: size,
    width: size,
  }), [size])
  const elementStyle = (index: number): React.CSSProperties => ({
    color: index === lessStressedPercent + 1 ? YOU_COLOR :
      index > lessStressedPercent ? BAD_COLOR : GOOD_COLOR,
  })
  const genderOffset = gender === 'MASCULINE' ? 0 : 1
  const SelfIcon = gender === 'MASCULINE' ? HumanMaleIcon : HumanFemaleIcon
  return <figure style={containerStyle}>
    <div style={gridStyle}>
      {Array.from({length: 100}, (_, index): React.ReactNode =>
        (genderOffset + index - lessStressedPercent) % 2 ?
          <HumanMaleIcon size={size / 10} style={elementStyle(index)} key={index} /> :
          <HumanFemaleIcon size={size / 10} style={elementStyle(index)} key={index} />)}
    </div>
    <figcaption style={{marginTop: isMobileVersion ? 0 : -10}}>
      <div style={stressPictorialCaptionRowStyle}>
        <HumanMaleFemaleIcon style={captionStyle(GOOD_COLOR)} />
        {t('Personnes qui font face à plus de concurrence que vous')}
      </div>
      <div style={stressPictorialCaptionRowStyle}>
        <SelfIcon style={captionStyle(YOU_COLOR)} />
        {t('Vous')}
      </div>
      <div style={stressPictorialCaptionRowStyle}>
        <HumanMaleFemaleIcon style={captionStyle(BAD_COLOR)} />
        {t('Personnes qui font face à moins de concurrence que vous')}
      </div>
    </figcaption>
  </figure>
}


export default React.memo(StressPictorialChart)
