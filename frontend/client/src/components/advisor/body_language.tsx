import React from 'react'

import Picto from 'images/advices/picto-body-language.svg'

import VideoFrame from 'components/video_frame'

import {CardProps} from './base'


const BodyLanguage: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {t} = props
  // TODO(pascal): Use handleExplore for when embedded video is played.
  return <div style={{margin: 'auto', maxWidth: 854}}>
    <VideoFrame>
      <iframe
        src={t('https://embed.ted.com/talks/lang/fr/amy_cuddy_your_body_language_shapes_who_you_are')}
        frameBorder={0} scrolling="no" allowFullScreen={true}
        title={t('Votre langage corporel forme qui vous êtes')} />
    </VideoFrame>
  </div>
}
const ExpandedAdviceCardContent = React.memo(BodyLanguage)

export default {ExpandedAdviceCardContent, Picto}
