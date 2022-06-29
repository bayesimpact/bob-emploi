import type {Hit} from '@algolia/client-search'
import React, {useCallback, useState} from 'react'

import {useAsynceffect} from 'store/promise'

import type {AlgoliaProps, Focusable} from 'components/autocomplete'
import Autocomplete, {HighlightText, fetchFromAlgolia} from 'components/autocomplete'

interface DepartementCompleteProps extends
  Omit<React.ComponentPropsWithoutRef<'input'>, 'onChange'|'value'>, Partial<AlgoliaProps> {
  onChange?: (departement?: bayes.bob.FrenchCity) => void
  value?: bayes.bob.FrenchCity
}

type Departement = {
  departementId: string
  departementName: string
}

const displayDepartement = (departement?: Partial<Departement>): string => {
  const {departementId: id = '', departementName: name = ''} = departement || {}
  return id && name ? `${id} - ${name}` : id
}

const DepartementItem = (item: Hit<Departement>): React.ReactElement =>
  item.departementId && item.departementName ? <React.Fragment>
    <HighlightText field="departementId" value={item} />
    {' - '}
    <HighlightText field="departementName" value={item} />
  </React.Fragment> : <HighlightText field="departementId" value={item} />

const departementFromSuggestion = (
  {departementId, departementName}: Departement): bayes.bob.FrenchCity => ({
  departementId,
  departementName,
})

const DepartementInput = (
  props: DepartementCompleteProps, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {onChange, value, ...otherProps} = props
  const [display, setDisplay] = useState(displayDepartement(value))
  useAsynceffect(async (checkIfCanceled): Promise<void> => {
    if (!value?.departementId) {
      return
    }
    if (value.departementName) {
      setDisplay(displayDepartement(value))
      return
    }
    setDisplay(value.departementId)
    const departement = await fetchFromAlgolia<'departementId', Departement>(
      config.departementSuggestAlgoliaIndex, 'departementId', value.departementId)
    if (departement && !checkIfCanceled()) {
      setDisplay(displayDepartement(departement))
    }
  }, [value])
  const handleChange = useCallback(
    (value?: Departement) => onChange?.(value && departementFromSuggestion(value)),
    [onChange],
  )

  return <Autocomplete<Departement>
    algoliaIndex={config.departementSuggestAlgoliaIndex} ref={ref}
    Item={DepartementItem} displayFunc={displayDepartement}
    onChange={onChange && handleChange} value={display} {...otherProps} />
}

export default React.memo(React.forwardRef(DepartementInput))
