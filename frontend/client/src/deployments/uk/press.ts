import achImage from './ach.jpg'
import mediumImage from './medium.png'
import nestaImage from './nesta.jpg'
import thersaImage from './thersa-future-of-work-award.jpg'


export default [
  {
    imageAltText: 'The RSA',
    imageSrc: thersaImage,
    title:
    'An open source application that uses AI to give jobseekers personalized, data-driven advice',
    url: 'https://www.thersa.org/projects/archive/economy/future-work-awards/winners/bob-emploi', // checkURL
  },
  {
    imageAltText: 'ACH',
    imageSrc: achImage,
    title: 'Bob UK the AI-powered job counsellor',
    url: 'https://ach.org.uk/news-and-features/bob-uk-ai-powered-job-counsellor-ach-named-finalist-career-tech-challenge', // checkURL
  },
  {
    imageAltText: 'Nesta',
    imageSrc: nestaImage,
    title: 'Supporting the six million most at risk of losing their jobs in the next decade',
    url: 'https://media.nesta.org.uk/documents/Precarious_to_prepared._A_manifesto_for_supporting_the_six_million_most_at_risk_of_losing_their_jobs_in_the_next_decade_v5.pdf', // checkURL
  },
  {
    imageAltText: 'Medium',
    imageSrc: mediumImage,
    title: 'Do we need to reinvent the internet?',
    url: 'https://medium.com/rsa-journal/do-we-need-to-reinvent-the-internet-d47efb9a2446', // checkURL
  },
] as const
