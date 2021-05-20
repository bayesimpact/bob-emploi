import mitInnovatorsImage from './mit-innovators.jpg'
import financialTimesImage from './financial-times.jpg'
import mediumImage from './medium.png'
import tomorrowMagImage from './tomorrow-mag.jpg'


export default [
  {
    imageAltText: 'Financial Times',
    imageSrc: financialTimesImage,
    title: 'Start-ups use matchmaking mindset to aid those in need',
    url: 'https://www.ft.com/content/5837b740-f975-11e9-a354-36acbbb0d9b6',
  },
  {
    imageAltText: 'Innovators Under 35',
    imageSrc: mitInnovatorsImage,
    title: "His NGO uses big data and AI to solve the world's problem",
    url: 'https://www.innovatorsunder35.com/the-list/paul-duan/',
  },
  {
    imageAltText: 'Tomorrow. Mag',
    imageSrc: tomorrowMagImage,
    title: 'We should trust in the power of the multitude',
    url: 'https://www.smartcitylab.com/blog/digital-transformation/paul-duan-interview-citizen-participation-public-services/',
  },
  {
    imageAltText: 'Medium',
    imageSrc: mediumImage,
    title: 'Do we need to reinvent the internet?',
    url: 'https://medium.com/rsa-journal/do-we-need-to-reinvent-the-internet-d47efb9a2446',
  },
] as const
