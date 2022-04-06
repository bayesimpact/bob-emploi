import React from 'react'
import {HandyLink} from 'components/advisor/base'
// TODO(émilie): Change for the UK training tips.

import nationalCareersServiceLogo from './national-careers-service-ico.png'
import type {GetTipsProps, Tips} from '../types/training'

// i18next-extract-mark-ns-start advisor

const footerStyle = {
  cursor: 'auto',
  display: 'block',
} as const

const getTips = (props: GetTipsProps): Tips => {
  const {commonTips, t} = props
  return {
    tips: [
      commonTips.friend,
      commonTips.recruiter,
      commonTips.coach,
      <HandyLink
        linkIntro={t('Trouvez une formation et lisez des témoignages sur')}
        href="https://nationalcareers.service.gov.uk/find-a-course" key="find-a-course"
        style={footerStyle}>
        Find a Course tool
      </HandyLink>,
    ],
  }
}

const websites = [
  {
    logo: nationalCareersServiceLogo,
    name: 'National Careers Service',
    url: 'https://nationalcareers.service.gov.uk/find-a-course', // checkURL
  },
] as const

export {getTips, websites}
