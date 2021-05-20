import React from 'react'

import {AUTOMATION_RISK_LEVELS} from 'components/statistics/automation_risk_gauge'
import JobGroupStressBars from 'components/statistics/job_groups_stress_bars'

const getAutomationRisk = ({jobGroup: {automationRisk = 0} = {}}: bayes.bob.RelatedJobGroup) =>
  automationRisk

const getRiskColor = (percent: number): string => AUTOMATION_RISK_LEVELS.
  find(({max, min}) => min < percent && max >= percent)?.color || ''

type StressBarsProps = React.ComponentPropsWithoutRef<typeof JobGroupStressBars>
type Props = Omit<StressBarsProps, 'getValue' | 'getValueColor' | 'isLogScale' | 'segments'>
const RelatedAutomationRisk = (props: Props): React.ReactElement => {
  return <JobGroupStressBars
    {...props} segments={AUTOMATION_RISK_LEVELS} isLogScale={false} context="risk"
    getValue={getAutomationRisk} getValueColor={getRiskColor} />
}

export default React.memo(RelatedAutomationRisk)
