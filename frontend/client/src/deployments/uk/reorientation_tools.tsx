import React from 'react'

import learnisaLogo from './learnisa-ico.png'
import careerShiftersLogo from './career-shifters-ico.svg'
import nationalCareersServiceLogo from './national-careers-service-ico.png'

export interface Tool {
  description: string
  from: React.ReactNode
  logo: string
  name: string
  url: string
}

const _REORIENTATION_TOOLS: readonly Tool[] = [
  {
    description: '',
    from: 'Free career change toolkit',
    logo: careerShiftersLogo,
    name: 'Career Shifters',
    url: 'https://www.careershifters.org/expert-advice/how-to-change-career-when-you-have-no-idea-what-youre-doing',
  },
  {
    description: '',
    from: 'Free guidance to find training',
    logo: learnisaLogo,
    name: 'Learnisa',
    url: 'https://www.learnisa.com/main/explore/career-change',
  },
  {
    description: '',
    from: 'National Careers Service quiz',
    logo: nationalCareersServiceLogo,
    name: 'Skills assessment',
    url: 'https://nationalcareers.service.gov.uk/skills-assessment',
  },
]

const getTools = (): readonly Tool[] => {
  return _REORIENTATION_TOOLS
}

export default getTools
