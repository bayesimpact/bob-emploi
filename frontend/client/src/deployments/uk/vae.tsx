import React from 'react'

import ExternalLink from 'components/external_link'

import type {ContentProps, Tip} from '../types/vae'

export const getTips = (): readonly Tip[] => {
  const content = <div style={{fontWeight: 'normal'}}>
    <p>NVQ is short for National Vocational Qualification, and this is a
      skill-based qualification. This means you receive qualifications for learning practical
      tasks that relate to a job and that help you to do a job effectively. You can receive
      an NVQ if you already have work-based skills and want to improve them, or if you are just
      starting out.</p>
    <p>There are five levels of NVQ that range from Level 1, based on basic work activities,
      up to Level 5, which is for senior management.</p>
    <p>It's important to know that NVQs must be completed within a training program.
      You can take NVQs if you are employed, are studying at FE college and working part-time,
      are completing an apprenticeship, or are at school.</p>
  </div>
  return [
    {
      content,
      intro: 'You can learn more about NVQs:',
      name: 'here',
      url: 'https://www.nidirect.gov.uk/articles/nvqs', // checkURL
    },
  ]
}

// TODO(émilie): DRY with association_help help content.
const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
}

const VaeHelpContentBase = ({handleExplore}: ContentProps): React.ReactElement => <div>
  Jobcentre Plus has offices across the UK, and is available to support you in your search
  for employment.

  You can reach out to your local Jobcentre Plus office for help in searching for a job or
  to make a benefit claim. Don't hesitate to make use of the help that's available to you
  in your search for employment--you can learn more about Jobcentre Plus <ExternalLink
    href="https://www.gov.uk/contact-jobcentre-plus" // checkURL
    onClick={handleExplore('link')} style={linkStyle}>here</ExternalLink>.
</div>

export const VaeHelpContent = React.memo(VaeHelpContentBase)
