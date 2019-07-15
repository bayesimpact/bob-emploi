declare module '*.svg' {
  const content: string
  export default content
}

// TODO(pascal): Solve those multiple declarations if https://stackoverflow.com/questions/56078811/
// gets an answer.
declare module '*.svg?fill=#fff' {
  const content: string
  export default content
}

declare module '*.svg?fill=#000' {
  const content: string
  export default content
}

declare module '*.svg?fill=#1888ff' {
  const content: string
  export default content
}

declare module '*.svg?stroke=#9596a0' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpg?multi&sizes[]=1440&sizes[]=600' {
  const content: {
    images: {path: string}[]
    src: string
  }
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}

declare module '*.txt' {
  const content: string
  export default content
}

interface RadiumCSSProperties extends React.CSSProperties {
  ':active'?: React.CSSProperties
  ':hover'?: React.CSSProperties
  ':focus'?: React.CSSProperties
}

type ReactStylableElement = React.ReactElement<{style?: RadiumCSSProperties}>

declare const colors: {[name: string]: string}
declare const config: {
  readonly amplitudeToken: string
  readonly clientVersion: string
  readonly donationUrl: string
  readonly facebookPixelID: string
  readonly facebookSSOAppId: string
  readonly emploiStoreClientId: string
  readonly githubSourceLink: string
  readonly googleSSOClientId: string
  readonly googleUAID: string
  readonly helpRequestUrl: string
  readonly jobGroupImageSmallUrl: string
  readonly jobGroupImageUrl: string
  readonly linkedInClientId: string
  readonly productName: string
  readonly sentryDSN: string
  readonly zendeskDomain: string
}
