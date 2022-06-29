import BASE_URL from './base'

interface Coding {
  name: string
  value: number
}

interface Filter {
  name: string
  codings: readonly Readonly<Coding>[]
}
const getAllRegions = async (): Promise<readonly Readonly<Coding>[]> => {
  const allFiltersReq = await fetch(`${BASE_URL}/ashe/filters/all`)
  const allFilters: readonly Filter[] = await allFiltersReq.json()
  return allFilters.find(({name}) => name === 'region')?.codings || []
}

// TODO(cyrille): Actually use this.
export default getAllRegions
