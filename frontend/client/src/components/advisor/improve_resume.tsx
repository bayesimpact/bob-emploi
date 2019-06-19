import PropTypes from 'prop-types'
import React from 'react'

import NewPicto from 'images/advices/picto-improve-resume.svg'

import {CardProps, ImproveApplicationTips, makeTakeAwayFromAdviceData} from './base'


class ExpandedAdviceCardContent extends React.PureComponent<CardProps> {
  public static propTypes = {
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const props = this.props
    return <ImproveApplicationTips
      {...props}
      sections={[
        {
          data: 'qualities',
          title: 'Qualités les plus attendues par les recruteurs\u00A0:',
        },
        {
          data: 'improvements',
          title: `Pour améliorer ${props.userYou('ta', 'votre')} candidature`,
        },
      ]}
    />
  }
}


const TakeAway = makeTakeAwayFromAdviceData(
  (adviceData: bayes.bob.ResumeTips): bayes.bob.ApplicationTip[] =>
    Object.values(adviceData).reduce(
      (allTips: bayes.bob.ApplicationTip[], sectionTips: bayes.bob.ApplicationTip[]):
      bayes.bob.ApplicationTip[] => [...allTips, ...sectionTips], []),
  'astuce', true)


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
