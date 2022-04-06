import type {TFunction} from 'i18next'
import React from 'react'

import VideoFrame from 'components/video_frame'


interface Props {
  t: TFunction
}
const ImproveInterviewContent = ({t}: Props): React.ReactElement => {
  // TODO(pascal): Use handleExplore for when embedded video is played.
  return <div style={{margin: 'auto', maxWidth: 854}}>
    <VideoFrame>
      <iframe
        src={t('https://www.youtube.com/embed/aGBxSkgL4eM')}
        scrolling="no" allowFullScreen={true}
        title={t(
          'Ces techniques vont vous aider à montrer votre motivation ' +
          "et à augmenter vos chances d'être recruté·e.")} />
    </VideoFrame>
  </div>
}
export default React.memo(ImproveInterviewContent)
