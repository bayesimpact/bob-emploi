import coLogo from './chamber-of-commerce-us-logo.svg'
import freelancersUnionLogo from './freelancers-union-logo.jpg'
import sbaLogo from './small-business-administration-logo.png'

export default [
  {
    description: '10 steps to start your business',
    from: 'Market research to taxes',
    logo: sbaLogo,
    name: 'U.S. Small Business Association',
    url: 'https://www.sba.gov/business-guide/10-steps-start-your-business',
  },
  {
    description: 'for advice including finding a good business idea',
    from: 'CO—',
    logo: coLogo,
    name: 'US Chamber of Commerce',
    url: 'https://www.uschamber.com/co/start',
  },
  {
    description: "advice from people who've been there, including insurance tips",
    from: 'Freelancers Union Events',
    logo: freelancersUnionLogo,
    name: 'Freelancers Union',
    url: 'https://www.freelancersunion.org/get-involved/spark-events/',
  },
] as const
