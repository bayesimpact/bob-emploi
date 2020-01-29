
interface PageDescription {
  description: string
  fullTitle: string
  title: string
  url: string
}


export function getPageDescription(pageUrl: string): Readonly<PageDescription>;
