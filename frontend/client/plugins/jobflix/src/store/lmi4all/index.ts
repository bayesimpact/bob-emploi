import BASE_URL from './base'

interface Soc {
  // eslint-disable-next-line camelcase
  add_titles: readonly string[]
  description: string
  qualifications: string
  soc: number
  tasks: string
  title: string
}

export default async (romeId: string): Promise<Soc> => {
  const response = await fetch(`${BASE_URL}/soc/code/${romeId}`)
  const content = await response.json()
  return content
}
