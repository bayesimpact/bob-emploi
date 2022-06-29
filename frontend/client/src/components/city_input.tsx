import type {Hit} from '@algolia/client-search'
import React, {useCallback} from 'react'

import type {AlgoliaProps, Focusable} from 'components/autocomplete'
import Autocomplete, {HighlightText, fetchFromAlgolia} from 'components/autocomplete'

interface Props extends
  Omit<React.ComponentPropsWithoutRef<'input'>, 'onChange'|'value'>, Partial<AlgoliaProps> {
  onChange?: (departement?: bayes.bob.FrenchCity) => void
  value?: bayes.bob.FrenchCity
}

interface CitySuggestion {
  admin1Code?: string
  admin1Name?: string
  admin2Code?: string
  admin2Name?: string
  cityId?: string
  departementId?: string
  departementName?: string
  departementPrefix?: string
  latitude?: number
  longitude?: number
  name: string
  objectID: string
  population: number
  regionId?: string
  regionName?: string
  transport?: number
  urban?: number
  zipCode?: string
}

const getBestAdmin2NameField = (item: CitySuggestion): 'departementName'|'admin2Name' =>
  item.departementName ? 'departementName' : 'admin2Name'

const getCityName = (city: CitySuggestion): string => city.name

const CityItem = (item: Hit<CitySuggestion>): React.ReactElement => <React.Fragment>
  <HighlightText field="name" value={item} />
  <span className="aa-group">
    <HighlightText field={getBestAdmin2NameField(item)} value={item} />
  </span>
</React.Fragment>

const cityFromSuggestion = ({
  admin1Code,
  admin1Name,
  admin2Code,
  admin2Name,
  cityId,
  departementId,
  departementName,
  departementPrefix,
  latitude,
  longitude,
  name,
  objectID,
  population,
  regionId,
  regionName,
  transport,
  urban,
  zipCode,
}: CitySuggestion): bayes.bob.FrenchCity => ({
  cityId: cityId || objectID,
  departementId: departementId || admin2Code,
  departementName: departementName || admin2Name,
  departementPrefix,
  latitude,
  longitude,
  name,
  population,
  postcodes: zipCode,
  ...transport && {publicTransportationScore: transport},
  regionId: regionId || admin1Code,
  regionName: regionName || admin1Name,
  urbanScore: urban === 0 ? -1 : urban,
})

export async function fetchCityByAdmin2Code(admin2Code?: string):
Promise<bayes.bob.FrenchCity|undefined> {
  const bestDeptSuggestion = await fetchFromAlgolia<'departementId', CitySuggestion>(
    config.citySuggestAlgoliaIndex, 'departementId', admin2Code)
  const bestSuggestion = bestDeptSuggestion ||
    await fetchFromAlgolia<'admin2Code', CitySuggestion>(
      config.citySuggestAlgoliaIndex, 'admin2Code', admin2Code)
  return bestSuggestion && cityFromSuggestion(bestSuggestion)
}

const CityInput = (props: Props, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {onChange, value, ...otherProps} = props
  const handleChange = useCallback(
    (value?: CitySuggestion) => onChange?.(value && cityFromSuggestion(value)),
    [onChange],
  )

  return <Autocomplete<CitySuggestion>
    algoliaIndex={config.citySuggestAlgoliaIndex} ref={ref}
    Item={CityItem} displayFunc={getCityName}
    onChange={onChange && handleChange} value={value?.name || ''} {...otherProps} />
}

export default React.memo(React.forwardRef(CityInput))
