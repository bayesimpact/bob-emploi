import React from 'react'
import {hot} from 'react-hot-loader/root'

import 'normalize.css'
import 'styles/App.css'

import isMobileVersion from 'store/mobile'

import Button, {BUTTON_TYPE_STYLES} from 'components/button'
import {colorToHSL} from 'components/colors'
import {FixedButtonNavigation} from 'components/navigation'

type ButtonType = keyof typeof BUTTON_TYPE_STYLES
const buttonTypes = Object.keys(BUTTON_TYPE_STYLES) as readonly ButtonType[]

const colorSquaredStyles = Object.fromEntries(Object.entries(colorsMap).map(
  ([name, color]) => [name, {
    backgroundColor: color,
    borderRadius: 3,
    display: 'inline-block',
    height: 20,
    width: 20,
  }]))

const colorHSL = Object.fromEntries(Object.entries(colorsMap).map(
  ([name, color]) => [name, colorToHSL(color)]))

type ColorName = keyof typeof colorsMap
const sortByHSL = (colors: readonly ColorName[]): readonly ColorName[] => {
  const sortedColors = [...colors]
  sortedColors.sort((nameA: ColorName, nameB: ColorName): number => {
    const {hue: hueA, saturation: saturationA, lightness: lightnessA} = colorHSL[nameA]
    const {hue: hueB, saturation: saturationB, lightness: lightnessB} = colorHSL[nameB]
    const isGreyA = saturationA < .08 || lightnessA < .4
    const isGreyB = saturationB < .08 || lightnessB < .4

    // Sort greys first.
    if (isGreyA !== isGreyB) {
      return isGreyA ? -1 : 1
    }

    const diffs = isGreyA ?
      // Among greys, sort blacks first.
      [lightnessA - lightnessB, saturationB - saturationA, hueB - hueA] :
      // Among colors, sort by hue.
      [hueB - hueA, saturationB - saturationA, lightnessB - lightnessA]

    for (const diff of diffs) {
      if (diff) {
        return diff
      }
    }
    return 0
  })
  return sortedColors
}
const sortedColors = sortByHSL(Object.keys(colorsMap) as ColorName[])

const mobileLikeStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_PROJECT_GREY,
  height: 400,
  margin: 'auto',
  overflow: 'hidden',
  position: 'relative',
  transform: 'scale(1)',
  width: 350,
}

const App = (): React.ReactElement => {
  return <React.Fragment>
    <h1>{config.productName} Design System</h1>
    <section>
      <h2>Buttons</h2>
      <table>
        <thead><tr>
          <th>Type</th>
          <th>Classic</th>
          <th>isRound</th>
          <th>isNarrow</th>
          <th>isRound + isNarrow</th>
        </tr></thead>
        <tbody>
          {buttonTypes.map((type: ButtonType) => <tr key={type}>
            <th>{type}</th>
            <td><Button type={type}>Click here</Button></td>
            <td><Button type={type} isRound={true}>Click here</Button></td>
            <td><Button type={type} isNarrow={true}>Click here</Button></td>
            <td><Button type={type} isRound={true} isNarrow={true}>Click here</Button></td>
          </tr>)}
        </tbody>
      </table>
      {isMobileVersion ? <div style={mobileLikeStyle}>
        <FixedButtonNavigation>Click here</FixedButtonNavigation>
      </div> : <div>Switch to mobile view to see mobile bottom CTA button.</div>}
    </section>
    <section>
      <h2>Colors</h2>
      <table>
        <tbody>
          {sortedColors.map((name) => <tr key={name}>
            <td>{name}</td>
            <td><span style={colorSquaredStyles[name]} /></td>
            <td>{colorsMap[name]}</td>
          </tr>)}
        </tbody>
      </table>
    </section>
  </React.Fragment>
}

export default hot(React.memo(App))
