import React from 'react'

declare namespace reactTwitterEmbed {

  interface TwitterTweetEmbedProps {
    tweetId: string
    options?: {
      cards?: 'hidden'
      conversation?: 'none'
      theme?: 'dark'
      linkColor?: string
      width?: number
      align?: 'left'|'right'|'center'
      lang?: string
      dnt?: boolean
    }
    placeholder?: React.ReactNode
    onLoad?: (element: HTMLElement) => void
  }
  
  interface ReactTwitterEmbedStatic {
    TwitterTweetEmbed: React.ComponentType<TwitterTweetEmbedProps>
  }
}

declare const reactTwitterEmbed: reactTwitterEmbed.ReactTwitterEmbedStatic

export = reactTwitterEmbed
export as namespace reactTwitterEmbed
