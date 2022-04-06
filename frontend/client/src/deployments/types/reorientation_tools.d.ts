export interface Tool {
  description: string
  from: React.ReactNode
  logo: string
  name: string
  url: string
}

declare const getTools: (hasHandicap?: boolean, departementId?: string) => readonly Tool[]

export default getTools
