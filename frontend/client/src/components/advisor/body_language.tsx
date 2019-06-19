import React from 'react'

import NewPicto from 'images/advices/picto-body-language.svg'

import {CardProps} from './base'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {

  public render(): React.ReactNode {
    const coverallStyle: React.CSSProperties = {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    }
    // TODO(pascal): Use handleExplore for when embedded video is played.
    // TODO(cyrille): Use VideoFrame from theme.
    return <div style={{margin: 'auto', maxWidth: 854}}>
      <div style={{height: 0, paddingBottom: '56.25%', position: 'relative'}}>
        <iframe
          src="https://embed.ted.com/talks/lang/fr/amy_cuddy_your_body_language_shapes_who_you_are"
          width="100%" height="100%"
          style={coverallStyle} frameBorder={0} scrolling="no" allowFullScreen={true} />
      </div>
    </div>
  }
}


const TakeAway = '1 vidéo trouvée'


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
