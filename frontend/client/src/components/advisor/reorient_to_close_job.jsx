import React from 'react'
import PropTypes from 'prop-types'

import {isMobileVersion} from 'components/mobile'
import {GrowingNumber} from 'components/theme'
import Picto from 'images/advices/reorient-to-close-job.png'

import {AdviceSuggestionList, connectExpandedCardWithContent,
  DataSource, JobSuggestion} from './base'


// TODO(marielaure): Refactor this with reorientation-jobbing advice.
class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
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
    onExplore: PropTypes.func.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {adviceData, onExplore, userYou} = this.props
    const {closeJobs, evolutionJobs} = adviceData.closeJobs || adviceData.evolutionJobs ?
      adviceData : {}
    const areCloseJobShown = (closeJobs || []).length > 1
    const style = {
      marginTop: areCloseJobShown ? 35 : 0,
    }

    return <div>
      <Section
        kind="close"
        items={closeJobs}
        userYou={userYou}
        onExplore={() => onExplore('close job')} />
      <Section
        kind="evolution"
        items={evolutionJobs}
        style={style}
        userYou={userYou}
        onExplore={() => onExplore('evolution job')} />
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)

class Section extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.object.isRequired),
    kind: PropTypes.oneOf(['close', 'evolution']).isRequired,
    onExplore: PropTypes.func.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {items, kind, onExplore, userYou, style} = this.props
    const text = kind === 'evolution' ?
      `proches que ${userYou('tu peux', 'vous pouvez')} acquérir` :
      `que ${userYou('tu as', 'vous avez')} déjà`
    if (!items) {
      return null
    }
    const hasManyItems = items.length > 1
    return <div style={style}>
      <div style={{marginBottom: 5}}>
        <div style={{color: colors.DARK_TWO, lineHeight: '20px'}}>
          <strong>
            {hasManyItems ? <React.Fragment>
              Ces <GrowingNumber number={items.length} /> domaines
            </React.Fragment> : 'Ce domaine'}
          </strong> demande{hasManyItems ? 'nt' : ''} des compétences {text}.
        </div>
      </div>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {items.map((job, index) => <JobSuggestion
          key={`job-${index}`}
          job={job} onClick={onExplore}
          style={isMobileVersion ? {paddingRight: 0} : null} />)}
      </AdviceSuggestionList>
      <DataSource>
        IMT 2017 / Pôle emploi
      </DataSource>
    </div>
  }
}

export default {ExpandedAdviceCardContent, Picto}
