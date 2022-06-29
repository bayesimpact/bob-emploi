import {prepareT as prepareTNoExtract} from 'store/i18n'

import type {Subtitle} from '../types/alternance'

const getSubtitle = (): Subtitle => ({
  source: '',
  text: prepareTNoExtract('As you weigh your options, it helps to think through some of ' +
    'the practical steps, like assessing your budget and your schedule. Make sure you have ' +
    'evidence about how the internship could lead to a concrete result. What will you need ' +
    'from it to turn it into a job, or a next step?'),
})

const simulatorLink = 'https://www.salaryexpert.com/salary' // checkURL
const simulatorName = 'Salary Expert'

const getDiscoverAction = (): null => null

const specificExpendableAction = {
  description: [
    prepareTNoExtract('An internship is a one-term work assignment, most often in the summer, ' +
      'but not always. Internships can be full- or part-time, paid or unpaid, depending on the ' +
      'employer and the career field. The idea of doing an internship is to get the contacts ' +
      'and experience you need to land a real job.'),
    prepareTNoExtract('A co-op is a paid job you do as part of a degree program. For ' +
      "example, you're officially a student for 5 years, but you already start working during " +
      'your studies, swapping some study semesters for a full-time, paid position with an' +
      'employer.'),
    prepareTNoExtract('With an apprenticeship, you get paid to learn new skills and gain the ' +
      'credentials you need to work in an in-demand occupation (jobs that the US needs more ' +
      'people to do). You do on-the-job training in the workplace, and also some classroom ' +
      'learning. More than 90% of workers who complete an apprenticeship earn an average of ' +
      '$70,000 annually, and 94% remain employed six months after completion.'),
  ],
  more: 'more',
  title: 'Internship, co-op, or apprenticeship?',
} as const

const footer = {
  intro: prepareTNoExtract("How to find companies that are hiring but aren't on job boards."),
  textUrl: prepareTNoExtract('Link to article.'),
  url: 'https://www.thebalancecareers.com/creating-a-target-list-of-companies-2060032', // checkURL
} as const

export {getDiscoverAction, footer, getSubtitle, simulatorLink, simulatorName,
  specificExpendableAction}

