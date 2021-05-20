import {TFunction} from 'i18next'

interface PageDescription {
  description: string
  image: string
  title: string
  url: string
}


export function getPageDescription(
  pageUrl: string, productName: string, canonicalUrl: string, t?: TFunction):
Readonly<PageDescription>;
