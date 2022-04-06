import React from 'react'

import Picto from 'images/advices/picto-body-language.svg'

import VideoFrame from 'components/video_frame'

import type {CardProps} from './base'


const BodyLanguage: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {t} = props
  // TODO(pascal): Use handleExplore for when embedded video is played.
  return <div style={{margin: 'auto', maxWidth: 854}}>
    <VideoFrame>
      <iframe
        src={t('https://youtube.com/embed/rBx66BptemU')}
        scrolling="no" allowFullScreen={true}
        title={t('Le langage non verbal en entretien')} />
    </VideoFrame>
  </div>
}
const ExpandedAdviceCardContent = React.memo(BodyLanguage)

export default {ExpandedAdviceCardContent, Picto}
