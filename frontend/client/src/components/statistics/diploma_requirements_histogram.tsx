import React from 'react'
import {useTranslation} from 'react-i18next'

import DataSource from 'components/data_source'
import HistogramBar, {barsContainerStyle, barStyle} from 'components/statistics/histogram_bar'


interface Props {
  highestDegree?: bayes.bob.DegreeLevel
  requirements: readonly bayes.bob.JobRequirement[]
  style?: React.CSSProperties
}


// Find the best degree in a list of diploma requirements lower or equal to a given degree.
const findBestMatchingDegree =
(degree: bayes.bob.DegreeLevel|undefined, requirements: readonly bayes.bob.JobRequirement[]):
bayes.bob.DegreeLevel|undefined => {
  if (!degree) {
    return degree
  }
  for (let i = requirements.length - 1; i >= 0; --i) {
    const {diploma} = requirements[i]
    if (diploma && diploma.level && diploma.level <= degree) {
      return diploma.level
    }
  }
  return undefined
}


const DiplomaRequirementsHistogram: React.FC<Props> = (props: Props): React.ReactElement => {
  const {highestDegree, requirements, style} = props
  const {t} = useTranslation()
  let totalRequirement = 0
  const cumSumRequirements = requirements.map(
    (requirement: bayes.bob.JobRequirement): bayes.bob.JobRequirement => {
      totalRequirement += requirement.percentRequired || 0
      return {
        ...requirement,
        percentRequired: totalRequirement,
      }
    })
  const bestDegree = findBestMatchingDegree(highestDegree, requirements)
  const percentNoRequirement = 100 - totalRequirement
  const accessibleOffers =
    [{name: t('Aucune formation scolaire')} as bayes.bob.JobRequirement, ...cumSumRequirements].
      map((requirement: bayes.bob.JobRequirement): bayes.bob.JobRequirement => ({
        ...requirement,
        percentRequired: (requirement.percentRequired || 0) + percentNoRequirement,
      }))
  return <div style={style}>
    <div style={barsContainerStyle}>
      {accessibleOffers.map((level: bayes.bob.JobRequirement): React.ReactNode =>
        <HistogramBar
          key={level.name} title={level.name || ''} height={`${level.percentRequired}%`}
          style={barStyle}
          isHighlighted={!bestDegree || (level.diploma && level.diploma.level) === bestDegree} />,
      )}
    </div>
    <DataSource style={{marginTop: 40}}>
      {t("Offres d'emploi enregistrées par Pôle emploi (2015-2017)")}
    </DataSource>
  </div>
}


export default React.memo(DiplomaRequirementsHistogram)
