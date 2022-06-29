import type {TFunction} from 'i18next'
import React from 'react'

import VideoFrame from 'components/video_frame'
import {Email, ProgramDetails, ProgramVideoMore, Subtitle} from 'deployment/immersion'

import type {CardProps} from './base'
import {MethodSuggestionList} from './base'

const countryContext = {context: config.countryId} as const


interface ProgramVideoProps {
  handleExplore: (visualElement: string) => () => void
  profile: bayes.bob.UserProfile
  t: TFunction
}

const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const ProgramVideoBase: React.FC<ProgramVideoProps> =
(props: ProgramVideoProps): React.ReactElement => {
  const {handleExplore, profile: {gender, name = ''}, t} = props
  return <MethodSuggestionList
    title={t('Faire un mini-stage en entreprise')}
    subtitle={<Subtitle handleExplore={handleExplore} linkStyle={linkStyle} />}
    headerContent={<React.Fragment>
      <VideoFrame style={{marginTop: 15}}>
        <iframe
          // TODO(cyrille): Handle explore 'video' when clicking in the iframe.
          // i18next-extract-mark-context-next-line ["uk", "usa"]
          src={t('https://www.youtube.com/embed/XWkDvcRc0gU', countryContext)}
          scrolling="no" allowFullScreen={true}
          title={t("L'immersion professionnelle en vidéo")} />
      </VideoFrame>
      {ProgramVideoMore ?
        <ProgramVideoMore handleExplore={handleExplore} linkStyle={linkStyle} /> : null}
    </React.Fragment>}>
    <div><Email handleExplore={handleExplore} gender={gender} name={name} /></div>
    {/* TODO(cyrille): Add a direct action to show an email template for pe counselor asking for
    a PMSMP.*/}
  </MethodSuggestionList>
}
const ProgramVideo = React.memo(ProgramVideoBase)

const ImmersionMethod: React.FC<CardProps> =
  (props: CardProps): React.ReactElement => {
    return <div>
      <ProgramVideo {...props} />
      <ProgramDetails />
    </div>
  }
const ExpandedAdviceCardContent = React.memo(ImmersionMethod)


export default {ExpandedAdviceCardContent, pictoName: 'rocket' as const}
