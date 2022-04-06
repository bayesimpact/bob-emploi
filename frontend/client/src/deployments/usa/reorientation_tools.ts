import learnisaLogo from './learnisa-ico.png'
import careerShiftersLogo from './career-shifters-ico.svg'
import nationalCareersServiceLogo from './national-careers-service-ico.png'

import type {Tool} from '../types/reorientation_tools'

const _REORIENTATION_TOOLS: readonly Tool[] = [
  {
    description: '',
    from: 'Free career change toolkit',
    logo: careerShiftersLogo,
    name: 'Career Shifters',
    url: 'https://www.careershifters.org/expert-advice/how-to-change-career-when-you-have-no-idea-what-youre-doing', // checkURL
  },
  {
    description: '',
    from: 'Free guidance to find training',
    logo: learnisaLogo,
    name: 'Learnisa',
    url: 'https://www.learnisa.com/main/explore/career-change', // checkURL
  },
  {
    description: '',
    from: 'National Careers Service quiz',
    logo: nationalCareersServiceLogo,
    name: 'Skills assessment',
    url: 'https://nationalcareers.service.gov.uk/skills-assessment', // checkURL
  },
]

const getTools = (): readonly Tool[] => _REORIENTATION_TOOLS

export default getTools
