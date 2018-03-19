import React from 'react'
import PropTypes from 'prop-types'

import {inDepartement, lowerFirstLetter} from 'store/french'

import {Colors, GrowingNumber, PaddedOnMobile, StringJoiner} from 'components/theme'
import Picto from 'images/advices/reorient-to-close-job.png'

import {AdviceSuggestionList, connectExpandedCardWithContent,
  DataSource, JobSuggestion} from './base'


// TODO(marielaure): Refactor this with reorientation-jobbing advice.
class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  computeJobText(jobNames) {
    const jobText = jobNames.map((name, index) => <strong key={`jobname-${index}`}>
      {lowerFirstLetter(name)} </strong>)
    return jobText
  }

  render() {
    const {advice, project: {mobility}, userYou} = this.props
    const {jobs} = advice.reorientData || {}
    const jobNames = (jobs || []).map(job => job.name)
    const jobText = this.computeJobText(jobNames)
    const location = mobility && inDepartement(mobility.city) ||
      `dans ${userYou('ton', 'votre')} département`

    return <div style={{fontSize: 30}}>
      Cela peut valoir le coup d'élargir {userYou('ta', 'votre')} recherche.
      <br />
      Des structures recrutent {jobNames.length ? <span>en <StringJoiner>
        {jobText}
      </StringJoiner></span> : null} {location} en ce moment.
    </div>
  }
}

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
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {adviceData, userYou} = this.props
    const {closeJobs, evolutionJobs} = adviceData.closeJobs || adviceData.evolutionJobs ?
      adviceData : {}
    const areCloseJobShown = (closeJobs || []).length > 1
    const sectionStyle = {
      marginTop: areCloseJobShown ? 35 : 0,
    }

    return <div>
      <Section
        kind="close"
        items={closeJobs}
        userYou={userYou} />
      <Section
        kind="evolution"
        items={evolutionJobs}
        style={sectionStyle}
        userYou={userYou} />
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)

class Section extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.object.isRequired),
    kind: PropTypes.oneOf(['close', 'evolution']).isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {items, kind, userYou, style} = this.props
    const {isMobileVersion} = this.context
    const text = kind === 'evolution' ?
      `proches que ${userYou('tu peux', 'vous pouvez')} acquérir` :
      `que ${userYou('tu as', 'vous avez')} déjà`
    if (!items) {
      return null
    }
    const hasManyItems = items.length > 1
    return <div style={style}>
      <PaddedOnMobile style={{marginBottom: 5}}>
        <div style={{color: Colors.DARK_TWO, fontSize: 16, lineHeight: '20px'}}>
          <strong>
            {hasManyItems ? <React.Fragment>
              Ces <GrowingNumber number={items.length} /> domaines
            </React.Fragment> : 'Ce domaine'}
          </strong> demande{hasManyItems ? 'nt' : ''} des compétences {text}.
        </div>
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {items.map((job, index) => <JobSuggestion
          key={`job-${index}`}
          job={job}
          style={isMobileVersion ? {paddingRight: 0} : null} />)}
      </AdviceSuggestionList>
      <DataSource>
        IMT 2017 / Pôle emploi
      </DataSource>
    </div>
  }
}

export default {AdviceCard, ExpandedAdviceCardContent, Picto}
