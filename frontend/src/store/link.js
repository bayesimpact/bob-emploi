// Module to manipulate links and URLs.


export const extractDomainName = url => {
  // Keep the regexp in sync with
  // data_analysis/bob_emploi/importer/airtable_to_protos.py.
  const matches = url.match(/^[^/]+:\/\/([^/]+)(\/|$)/)
  if (!matches) {
    return ''
  }
  return matches[1]
}
