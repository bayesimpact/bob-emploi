import govUkLogo from './gov-uk-logo.png'
import lepNetworkLogo from './lep-network-logo.png'
import masLogo from './mas-logo.png'

export default [
  {
    description: 'Get help starting your business',
    from: 'Official helpline, website and chat services',
    logo: govUkLogo,
    name: 'UK government',
    url: 'https://www.gov.uk/business-support-helpline', // checkURL
  },
  {
    description: 'Growth Hubs',
    from: 'Free local groups & advice for running your own business',
    logo: lepNetworkLogo,
    name: 'Local Enterprise Partnerships',
    url: 'https://www.lepnetwork.net/local-growth-hub-contacts/', // checkURL
  },
  {
    description: 'Money Navigator Tool',
    from: 'A useful free & interactive tool for freelancers',
    logo: masLogo,
    name: 'The Money Advice Service',
    url: 'https://www.moneyadviceservice.org.uk/en/tools/money-navigator-tool/questionnaire', // checkURL
  },
] as const
