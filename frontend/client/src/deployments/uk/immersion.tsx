import React from 'react'

import ExternalLink from 'components/external_link'
import Markdown from 'components/markdown'

import type {EmailProps} from '../types/immersion'

interface Props {
  handleExplore: (visualElement: string) => () => void
  linkStyle?: React.CSSProperties
}

// TODO(émilie): Not translated as used only for UK version, but needs to be translated.
const SubtitleBase = ({handleExplore, linkStyle}: Props): React.ReactElement => <div>
  You need to be 18 to 24 and meet low-income criteria. See
  their <ExternalLink
    href="http://www.jobcorps.gov/" onClick={handleExplore('link')} style={linkStyle}>
  website</ExternalLink> or <ExternalLink
    href="https://www.youtube.com/channel/UCBS5sCjjmYGe2T9uDNPgd4w"
    onClick={handleExplore('link')} style={linkStyle}>
  YouTube channel</ExternalLink>.
</div>


const Subtitle = React.memo(SubtitleBase)

const Email = (unusedProps: EmailProps): React.ReactElement|null => null

const content = 'A great way to learn about a job is to "shadow" someone who is already ' +
  'working in your target job.\n\n"Work shadowing" is when you spend time following a ' +
  'professional during their work day so that you can see what the job is like on a ' +
  'day-to-day basis. You can shadow someone for a day or for a whole week if possible ' +
  '-- any amount of time helps!\n\nReach out to people in your network, a career coach ' +
  "at your local job center, or recruiters to ask if it's possible shadow someone in your " +
  "target job.\n\nIf you aren't able to shadow someone in real-life, these " +
  '[videos](https://www.youtube.com/user/CareerOneStop/playlists) can also give you a good ' +
  'picture of what a job is like, and this ' +
  '[website](https://nationalcareers.service.gov.uk/explore-careers) lists key information ' +
  'about jobs like the salary, training requirements, and more.\n\nWant to learn more? ' +
  'Here is an [article]' + '(https://www.prospects.ac.uk/jobs-and-work-experience/' +
  'work-experience-and-internships/work-shadowing) with more information on work shadowing.'

const ProgramDetailsBase = (): React.ReactElement =>
  <Markdown content={content} />

const ProgramDetails = React.memo(ProgramDetailsBase)
const ProgramVideoMore = (): null => null

export {Email, ProgramDetails, ProgramVideoMore, Subtitle}
