import React from 'react'
import PropTypes from 'prop-types'

import {YouChooser} from 'store/french'

import {GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-reorient-to-close-job.svg'

import {CardProps, CardWithContentProps, DataSource, JobSuggestion, MethodSuggestionList,
  connectExpandedCardWithContent, makeTakeAwayFromAdviceData} from './base'


// TODO(marielaure): Refactor this with reorientation-jobbing advice.
class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.ReorientCloseJobs>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      closeJobs: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        offersPercentGain: PropTypes.number,
      }).isRequired),
      evolutionJobs: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        offersPercentGain: PropTypes.number,
      }).isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    project: PropTypes.shape({
      city: PropTypes.object,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {adviceData, handleExplore, profile: {gender}, project: {city}, userYou} = this.props
    const {closeJobs = [], evolutionJobs = []} = adviceData.closeJobs || adviceData.evolutionJobs ?
      adviceData : {}
    const areCloseJobShown = closeJobs.length > 1
    const style = {
      marginTop: areCloseJobShown ? 20 : 0,
    }

    // TODO(cyrille): Add short sentences to explain candidates per offer.
    return <div>
      <Section
        kind="close"
        items={closeJobs}
        {...{city, gender, userYou}}
        onExplore={handleExplore('close job')} />
      <Section
        kind="evolution"
        items={evolutionJobs}
        {...{city, gender, style, userYou}}
        onExplore={handleExplore('evolution job')} />
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.ReorientCloseJobs, CardProps>()(
    ExpandedAdviceCardContentBase)


interface SectionProps {
  city?: bayes.bob.FrenchCity
  gender?: bayes.bob.Gender
  items?: readonly bayes.bob.ReorientJob[]
  kind: 'close' | 'evolution'
  onExplore: () => void
  style?: React.CSSProperties
  userYou: YouChooser
}


class Section extends React.PureComponent<SectionProps> {
  public static propTypes = {
    city: PropTypes.object,
    gender: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.object.isRequired),
    kind: PropTypes.oneOf(['close', 'evolution']).isRequired,
    onExplore: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {city, gender, items = [], kind, onExplore, userYou, style} = this.props
    const text = kind === 'evolution' ?
      `proches que ${userYou('tu peux', 'vous pouvez')} acquérir` :
      `que ${userYou('tu as', 'vous avez')} déjà`
    if (!items.length) {
      return null
    }
    const hasManyItems = items.length > 1
    const title = <React.Fragment>
      <GrowingNumber number={items.length} /> domaine{hasManyItems ? 's' : ''} qui
      demande{hasManyItems ? 'nt' : ''} des compétences {text}.
    </React.Fragment>
    return <MethodSuggestionList
      style={style} title={title}
      footer={<DataSource style={{margin: 0}}>IMT 2019 / Pôle emploi</DataSource>}>
      {items.map((job, index): ReactStylableElement => <JobSuggestion
        isMethodSuggestion={true}
        key={`job-${index}`} onClick={onExplore} {...{city, gender, job}} />)}
    </MethodSuggestionList>
  }
}


const TakeAway = makeTakeAwayFromAdviceData(
  ({closeJobs = [], evolutionJobs = []}: bayes.bob.ReorientCloseJobs): bayes.bob.ReorientJob[] =>
    [...closeJobs, ...evolutionJobs],
  'métier')


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
