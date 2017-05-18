import React from 'react'

import calendarImage from 'images/calendar-picto.svg'
import competitionImage from 'images/competition-picto.svg'
import interviewImage from 'images/interview-picto.svg'
import jobTypeImage from 'images/job-type-picto.svg'
import offersEvolutionImage from 'images/offers-evolution-picto.svg'
import resumeImage from 'images/resume-picto.svg'

import {totalInterviewsDisplay} from './project'


// Linearly map a value within a source range into a destination range.
// Given 2 ranges, [min, max] => [MIN, MAX], a value v is mapped to a
// destination V where V has the same relative distance from MIN and MAX that v
// has from min and max.
function reScale(srcRange, dstRange, value) {
  return dstRange[0] + (dstRange[1] - dstRange[0]) *
    (value - srcRange[0]) / (srcRange[1] - srcRange[0])
}


// TODO(pascal): Factorize with text in jobsearch.jsx.
const WEEKLY_APPLICATIONS_SCORES = {
  'A_LOT': {
    display: 'Plus de 15 candidatures',
    score: 3.1,
  },
  'DECENT_AMOUNT': {
    display: '6 à 15 candidatures',
    score: 2,
  },
  'LESS_THAN_2': {
    display: '0 ou 1 candidature',
    score: -3.1,
  },
  'SOME': {
    display: '2 à 5 candidatures',
    score: -1,
  },
}


// Parts of Bob Score: the Bob Score is computed as a combination of multiple
// parts, each part is a metric which we evaluate for the current user and
// project. This array defines each part with both properties that are static
// and others that can only be computed with the user and project objects.
const BOB_SCORE_PARTS = [
  // Unemployment duration.
  {
    category: 'market',
    compute: (user, {localStats}) => {
      const {days} = localStats && localStats.unemploymentDuration || {}
      return {
        display: <span>
          <strong>{Math.round((days || 0)/ 30)} mois</strong> de retour à l'emploi en moyenne
        </span>,
        score: days ? reScale([150, 30], [-3, 3], days) : 0,
      }
    },
    iconSrc: calendarImage,
    scorePartId: 'unemployment-duration',
  },
  // Job offers evolution.
  {
    category: 'market',
    compute: (user, {localStats}) => {
      const {jobOffersChange} = localStats || {}
      const roundedChange = Math.round(jobOffersChange || 0)
      return {
        display: <span>
          <strong>{roundedChange > 0 ? '+' : ''}{roundedChange}%</strong> d'offres en 2016
        </span>,
        score: roundedChange ? reScale([-40, 40], [-3, 3], jobOffersChange) : 0,
      }
    },
    iconSrc: offersEvolutionImage,
    scorePartId: 'job-offers-change',
  },
  // Percentage of long-term contracts.
  {
    category: 'market',
    compute: (user, {localStats}) => {
      const {employmentTypePercentages} = localStats && localStats.imt || {}
      if (!employmentTypePercentages) {
        return {score: 0}
      }
      let percentCDI = 0
      employmentTypePercentages.forEach(({employmentType, percentage}) => {
        if (employmentType === 'CDI') {
          percentCDI = percentage
        }
      })
      return {
        display: <span>
          <strong>{Math.round(percentCDI)}%</strong> d'offres en CDI
        </span>,
        score: reScale([10, 90], [-3, 3], percentCDI),
      }
    },
    iconSrc: jobTypeImage,
    scorePartId: 'percent-cdi',
  },
  // IMT market stress.
  {
    category: 'market',
    compute: (user, {localStats}) => {
      const imt = localStats && localStats.imt || {}
      const {yearlyAvgOffersDenominator} = imt
      const yearlyAvgOffersPer10Candidates = imt.yearlyAvgOffersPer10Candidates ||
        imt.yearlyAvgOffersPer10Openings
      if (!yearlyAvgOffersDenominator || ! yearlyAvgOffersPer10Candidates) {
        return {score: 0}
      }
      const marketScore = (yearlyAvgOffersPer10Candidates || 0) / yearlyAvgOffersDenominator
      return {
        display: <span>
          <strong>{yearlyAvgOffersPer10Candidates} offre
            {yearlyAvgOffersPer10Candidates > 1 ? 's' : ''} </strong>
          pour {yearlyAvgOffersDenominator} candidats
        </span>,
        score: reScale([.15, 1.5], [-3, 3], marketScore),
      }
    },
    iconSrc: competitionImage,
    scorePartId: 'market-stress',
  },
  // Applications per week.
  {
    category: 'user',
    compute: (user, {weeklyApplicationsEstimate}) => {
      const {display, score} = WEEKLY_APPLICATIONS_SCORES[weeklyApplicationsEstimate] || {}
      return {
        display: display ? <span><strong>{display}</strong> par semaine</span> : null,
        score: score || 0,
      }
    },
    iconSrc: resumeImage,
    scorePartId: 'applications-per-week',
  },
  // Number of interviews.
  {
    category: 'user',
    compute: (user, project) => {
      const {jobSearchLengthMonths, totalInterviewCount, totalInterviewsEstimate,
        weeklyApplicationsEstimate} = project
      const interviewsDisplay = totalInterviewsDisplay(project)
      if (!weeklyApplicationsEstimate || (jobSearchLengthMonths || 0) < 2 || !interviewsDisplay) {
        // Impossible to estimate interviews.
        return {score: 0}
      }

      if (totalInterviewsEstimate === 'LESS_THAN_2' || totalInterviewCount < 0) {
        return {
          display: <span><strong>Pas d'entretien</strong> pour l'instant</span>,
          score: -3.1,
        }
      }
      if (totalInterviewsEstimate === 'A_LOT' || totalInterviewCount > 20) {
        return {
          // TODO(pascal): We should not score that so high, this is not a good sign
          display: <strong>{interviewsDisplay}</strong>,
          score: 3.1,
        }
      }

      if (jobSearchLengthMonths > 3 && totalInterviewsEstimate === 'SOME' ||
        jobSearchLengthMonths > 6 && totalInterviewsEstimate === 'DECENT_AMOUNT' ||
        totalInterviewCount > 0 && jobSearchLengthMonths / totalInterviewCount > 3) {
        const duringDisplay = ` en ${jobSearchLengthMonths} mois`
        return {
          display: <span><strong>Peu d'entretiens</strong> {duringDisplay}</span>,
          score: -2,
        }
      }

      const {display: weeklyApplicationDisplay} =
        WEEKLY_APPLICATIONS_SCORES[weeklyApplicationsEstimate] || {}
      if (weeklyApplicationDisplay &&
        weeklyApplicationsEstimate !== 'A_LOT' &&
        weeklyApplicationsEstimate !== 'DECENT_AMOUNT') {
        return {
          display: <span>
            <strong>{interviewsDisplay} </strong>
            pour {weeklyApplicationDisplay} par semaine
          </span>,
          score: 1,
        }
      }

      return {
        display: <span>
          <strong>{interviewsDisplay} </strong>
          pour {weeklyApplicationDisplay} par semaine
        </span>,
        score: -1,
      }
    },
    iconSrc: interviewImage,
    scorePartId: 'interviews',
  },
]


function computeBobScore(user, project) {
  const components = BOB_SCORE_PARTS.map(({compute, ...extra}) => ({
    ...extra,
    ...compute(user, project),
  }))
  const clampScore = score => Math.min(3, Math.max(-3, score))
  const totalScore = components.reduce((totalScore, {score}) => totalScore + clampScore(score), 0)
  const percent = reScale([-3, 3], [30, 95], totalScore / components.length)
  return {
    components: components.sort(
      ({score: scoreA}, {score: scoreB}) => Math.abs(scoreB) - Math.abs(scoreA)),
    percent,
  }
}


export {computeBobScore}
