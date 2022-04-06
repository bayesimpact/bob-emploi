import React, {useImperativeHandle, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import useFastForward from 'hooks/fast_forward'
import type {RootState} from 'store/actions'
import {useAsynceffect} from 'store/promise'

import type {Focusable} from 'components/autocomplete'
import {fetchFromAlgolia} from 'components/autocomplete'
import CityInput from 'components/city_input'
import DepartementInput from 'components/departement_input'
import {sampleCities} from 'deployment/user_examples'

export const countryAreaContext = {context: `${config.countryId}_${config.areaSuggest}`} as const
export const fullContext = {
  context: `${config.goalWordingContext}_${countryAreaContext.context}`,
} as const

const isUsingDepartement = config.areaSuggest === 'DEPARTEMENT'

export const useCity = (): bayes.bob.FrenchCity => useSelector(
  ({user}: RootState) => user?.projects?.[0]?.city || {},
  ({cityId, departementId: id}, {cityId: otherCity, departementId: otherId}) =>
    id === otherId && (cityId === otherCity || isUsingDepartement),
)

const DepartementSuggest = (
  props: React.ComponentPropsWithoutRef<typeof DepartementInput>,
  ref: React.Ref<Focusable>,
): React.ReactElement => {
  const {onChange, value: {departementId} = {}} = props
  const {t} = useTranslation()
  const hasDepartementId = !!departementId
  useFastForward(() => {
    if (hasDepartementId) {
      return true
    }
    if (sampleCities[0] && onChange) {
      onChange(sampleCities[0])
    }
  }, [hasDepartementId, onChange])

  const Suggest = isUsingDepartement ? DepartementInput : CityInput

  const suggestRef = useRef<Focusable>(null)
  useImperativeHandle(ref, (): Focusable => ({
    focus: (): void => {
      suggestRef.current?.focus()
    },
  }))

  return <Suggest
    filters={config.regionId ? `regionId:${config.regionId}` : undefined}
    // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
    placeholder={t('42, Loire, Gers', countryAreaContext)}
    ref={suggestRef}
    {...props} />
}

const DepartementNameBase = (): React.ReactElement => {
  const reduxCity = useCity()
  const [{name, departementName, departementId}, setCity] = useState(reduxCity)

  useAsynceffect(async (checkIfCanceled): Promise<void> => {
    if (
      !reduxCity.departementId ||
      reduxCity.departementId === departementId && departementName) {
      return
    }
    const fullCity = await fetchFromAlgolia<'departementId', bayes.bob.FrenchCity>(
      isUsingDepartement ? config.departementSuggestAlgoliaIndex : config.citySuggestAlgoliaIndex,
      'departementId', reduxCity.departementId)
    if (!fullCity || checkIfCanceled()) {
      return
    }
    setCity(fullCity)
  }, [reduxCity.departementId, departementId, departementName])

  if (isUsingDepartement || !name) {
    return <React.Fragment>
      {departementId || ''}{
        departementName ? ` - ${departementName}` : ''
      }
    </React.Fragment>
  }
  return <React.Fragment>{name}</React.Fragment>
}
export const DepartementName = React.memo(DepartementNameBase)

export default React.memo(React.forwardRef(DepartementSuggest))
