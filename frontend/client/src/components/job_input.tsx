import type {Hit} from '@algolia/client-search'
import React, {useCallback} from 'react'

import {genderizeJob} from 'store/job'

import type {AlgoliaProps, Focusable} from 'components/autocomplete'
import Autocomplete, {HighlightText, fetchFromAlgolia} from 'components/autocomplete'

interface Props extends
  Omit<React.ComponentPropsWithoutRef<'input'>, 'onChange'|'value'>, Partial<AlgoliaProps> {
  gender?: bayes.bob.Gender
  onChange?: (departement?: bayes.bob.Job) => void
  value?: bayes.bob.Job
}

interface JobSuggestion {
  codeOgr: string
  libelleRome: string
  codeRome: string
  libelleAppellationCourt: string
  libelleAppellationCourtFeminin: string
  libelleAppellationCourtMasculin: string
  libelleAppellationLong: string
  libelleAppellationLongFeminin?: string
  libelleAppellationLongMasculin?: string
  jobGroupId?: string
  jobGroupName?: string
  name?: string
  objectID: string
}

// Assemble a Job proto from a JobSuggest suggestion.
// Exported only for testing.
export function jobFromSuggestion(suggestion?: JobSuggestion): bayes.bob.Job|undefined {
  if (!suggestion) {
    return undefined
  }
  const job: bayes.bob.Job = {
    codeOgr: suggestion.codeOgr || suggestion.objectID,
    feminineName: suggestion.libelleAppellationCourtFeminin || undefined,
    jobGroup: {
      name: suggestion.jobGroupName || suggestion.libelleRome,
      romeId: suggestion.jobGroupId || suggestion.codeRome,
    },
    masculineName: suggestion.libelleAppellationCourtMasculin || undefined,
    name: suggestion.name || suggestion.libelleAppellationCourt,
  }
  return job
}

type JobNameField =
  | 'libelleAppellationCourt'
  | 'libelleAppellationCourtFeminin'
  | 'libelleAppellationCourtMasculin'
  | 'name'

const getBestJobField = (item: Hit<JobSuggestion>, gender?: bayes.bob.Gender): JobNameField => {
  if (gender === 'FEMININE' && item.libelleAppellationCourtFeminin) {
    return 'libelleAppellationCourtFeminin'
  }
  if (gender === 'MASCULINE' && item.libelleAppellationCourtMasculin) {
    return 'libelleAppellationCourtMasculin'
  }
  if (item.name) {
    return 'name'
  }
  return 'libelleAppellationCourt'
}

const JobInput = (props: Props, ref?: React.Ref<Focusable>): React.ReactElement => {
  const {gender, onChange, value, ...otherProps} = props
  const handleChange = useCallback(
    (value?: JobSuggestion) => onChange?.(value && jobFromSuggestion(value)),
    [onChange],
  )

  const renderSuggestion = useCallback(
    (item: Hit<JobSuggestion>): React.ReactElement => {
      const jobGroupField: 'jobGroupName'|'libelleRome' =
        item.jobGroupName ? 'jobGroupName' : 'libelleRome'
      return <React.Fragment>
        <HighlightText field={getBestJobField(item, gender)} value={item} />
        <span className="aa-group"><HighlightText field={jobGroupField} value={item} /></span>
      </React.Fragment>
    }, [gender])

  const displaySuggestion = useCallback(
    (item: JobSuggestion): string => {
      if (item) {
        return ''
      }
      return item[getBestJobField(item, gender)]
    }, [gender])

  return <Autocomplete<JobSuggestion>
    algoliaIndex={config.jobSuggestAlgoliaIndex} ref={ref}
    Item={renderSuggestion} displayFunc={displaySuggestion}
    onChange={onChange && handleChange}
    value={value && genderizeJob(value, gender) || ''} {...otherProps} />
}

export async function fetchJobByName(name?: string): Promise<bayes.bob.Job|undefined> {
  const suggestion = await fetchFromAlgolia<'name', JobSuggestion>(
    config.jobSuggestAlgoliaIndex, 'name', name)
  return jobFromSuggestion(suggestion)
}

export default React.memo(React.forwardRef(JobInput))
