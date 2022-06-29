import React, {Suspense, useState} from 'react'

import 'normalize.css'
import 'styles/App.css'

import {init as i18nInit} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import Button, {BUTTON_TYPE_STYLES} from 'components/button'
import {colorToHSL} from 'components/colors'
import {FixedButtonNavigation} from 'components/navigation'
import CityInput from 'components/city_input'
import DepartementInput from 'components/departement_input'

import type {ConfigColor} from 'config'

i18nInit()

type ButtonType = keyof typeof BUTTON_TYPE_STYLES
const buttonTypes = Object.keys(BUTTON_TYPE_STYLES) as readonly ButtonType[]

type ColorName = keyof typeof colorsMap

const colorSquaredStyles = Object.fromEntries(Object.entries(colorsMap).map(
  ([name, color]): [ColorName, React.CSSProperties] => [name as ColorName, {
    backgroundColor: color as ConfigColor,
    borderRadius: 3,
    display: 'inline-block',
    height: 20,
    width: 20,
  }]))

const colorHSL = Object.fromEntries(Object.entries(colorsMap).map(
  ([name, color]) => [name as ColorName, colorToHSL(color as ConfigColor)]))

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
  const [departement, setDepartement] = useState<bayes.bob.FrenchCity|undefined>()
  const [city, setCity] = useState<bayes.bob.FrenchCity|undefined>()
  return <Suspense fallback={<div />}>
    <h1>{config.productName} Design System</h1>
    <section>
      <h2>Inputs</h2>
      <label htmlFor="dep-input">Département:</label>
      <DepartementInput
        onChange={setDepartement} value={departement} placeholder="Enter a département"
        id="dep-input" />
      <label htmlFor="city-input">City:</label>
      <CityInput
        onChange={setCity} value={city} placeholder="Enter a city"
        id="city-input" />
    </section>
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
  </Suspense>
}

export default React.memo(App)
