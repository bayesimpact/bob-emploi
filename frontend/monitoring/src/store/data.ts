import {useEffect, useState} from 'react'

const DATA_URL = 'data.json'

type OldData = bayes.bob.monitoring.Data['sites']

type Data = bayes.bob.monitoring.Data
const dataAsync: Promise<Data> = (async () => {
  const response = await fetch(DATA_URL)
  const oldOrNew: Data | OldData = await response.json()
  const fetchedData = (oldOrNew as Data)
  if (fetchedData.computedAt || fetchedData.sites) {
    return fetchedData
  }
  return {sites: oldOrNew as OldData}
})()

export default (): Data => {
  const [myData, setData] = useState<Data>({sites: {}})
  useEffect(() => {
    (async () => setData(await dataAsync))()
  }, [])
  return myData
}
