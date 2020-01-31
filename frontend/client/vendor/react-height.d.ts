import React from 'react'

interface ReactHeightProps extends React.HTMLProps<HTMLDivElement> {
  children: React.ReactElement | string | readonly React.ReactNode[]
  dirty?: boolean
  getElementHeight?: (div: HTMLDivElement) => number
  hidden?: boolean
  onHeightReady: (height: number) => void
}

declare class ReactHeight extends React.PureComponent<ReactHeightProps> {}

export = ReactHeight
