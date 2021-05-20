// Helper elements for statistics.

import {prepareT} from 'store/i18n'

// Our data is updated monthly so it's 2 weeks old in average.
const dataSourceYear = new Date(Date.now() - 14 * 24 * 3600 * 1000).getFullYear()

const bobSourceText = prepareT(
  'Enquête réalisée auprès des utilisateurs de {{productName}} ({{yearForData}}).',
  {productName: config.productName, yearForData: dataSourceYear},
)

// Get counts for the user search length bucket.
const getSearchLenghtCounts =
(searchLenghtMonths: number|undefined, counts: readonly bayes.bob.PassionLevelCategory[]):
readonly bayes.bob.PassionLevelCount[]|undefined => {
  const searchInMonths = searchLenghtMonths || 0
  const filter = searchInMonths < 4 ? 'SHORT_SEARCH_LENGTH' : searchInMonths < 13 ?
    'MEDIUM_SEARCH_LENGTH' : searchInMonths > 13 ? 'LONG_SEARCH_LENGTH' : ''
  if (filter) {
    const SearchLenghtCounts = counts.find(count => count.searchLength === filter)
    return SearchLenghtCounts && SearchLenghtCounts.levelCounts
  }
  return undefined
}

export {bobSourceText, dataSourceYear, getSearchLenghtCounts}
