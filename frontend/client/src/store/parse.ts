import _mapValues from 'lodash/mapValues'
import _pickBy from 'lodash/pickBy'
import {parse} from 'query-string'


const flattenArray = {
  first: (values: readonly string[]): string => values[0],
  join: (values: readonly string[]): string => values.join(','),
  last: (values: readonly string[]): string => values[values.length - 1],
} as const
type ArrayMode = keyof typeof flattenArray


function createParsedValueFlattener(flatten: (values: readonly string[]) => string):
((values: string|null|undefined|(string|null)[]) => string|undefined) {
  return (values: string|null|undefined|(string|null)[]): string|undefined => {
    if (typeof values === 'string') {
      return values
    }
    if (values) {
      return flatten(values.filter(
        (value: string|null): value is string => typeof value === 'string'))
    }
  }
}

const parsedValueFlattener = _mapValues(flattenArray, createParsedValueFlattener)


function parseQueryString(
  queryString: string, arrayMode: ArrayMode = 'last'): {[key: string]: string} {
  const params = parse(queryString)
  const flattener = parsedValueFlattener[arrayMode]
  return _pickBy(
    _mapValues(params, flattener),
    (v: string|undefined): v is string => typeof v === 'string')
}


interface Location {
  hash: string
  pathname: string
  search: string
}


function removeAmpersandDoubleEncodingInString(search?: string): string {
  if (!search || !/&amp;/.test(search)) {
    return search || ''
  }
  return search.replace(/&amp;/g, '&')
}


function removeAmpersandDoubleEncoding(location: Location): string|undefined {
  const {hash, pathname, search} = location
  const fixedSearch = removeAmpersandDoubleEncodingInString(search)
  if (search !== fixedSearch) {
    return pathname + removeAmpersandDoubleEncodingInString(search) + hash
  }
}


export {
  parseQueryString,
  parsedValueFlattener,
  removeAmpersandDoubleEncoding,
  removeAmpersandDoubleEncodingInString,
}
