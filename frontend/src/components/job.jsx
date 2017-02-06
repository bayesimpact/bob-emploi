import React from 'react'
import {connect} from 'react-redux'
import moment from 'moment'
moment.locale('fr')


const THRESHOLDS = {
  jobOffersChange: {
    bad: -5,
    good: 0,
    hide: -30,
  },
  marketStress: {
    bad: 5,
    good: 9,
  },
  unemploymentDuration: {
    bad: -180,
    good: -90,
  },
}


import {Colors} from 'components/theme'

class JobGroupStatsBase extends React.Component {
  static propTypes = {
    imt: React.PropTypes.shape({
      yearlyAvgOffersDenominator: React.PropTypes.number,
      yearlyAvgOffersPer10Candidates: React.PropTypes.number,
      yearlyAvgOffersPer10Openings: React.PropTypes.number,
    }),
    jobOffersChange: React.PropTypes.number,
    salary: React.PropTypes.shape({
      shortText: React.PropTypes.string,
    }),
    sectionStyle: React.PropTypes.object,
    style: React.PropTypes.object,
    unemploymentDuration: React.PropTypes.shape({days: React.PropTypes.number}),
    yearOfBirth: React.PropTypes.number,
  }

  estimateStyle(value, thresholds) {
    const goodStyle = {
      color: Colors.HOVER_GREEN,
      fontWeight: 'bold',
    }
    if (value > thresholds.good) {
      return goodStyle
    }
    if (value < thresholds.bad) {
      return {...goodStyle, color: Colors.RED_PINK}
    }
    return {...goodStyle, color: Colors.SQUASH}
  }

  renderSalary() {
    const {imt, salary, sectionStyle, yearOfBirth} = this.props
    if (yearOfBirth && imt) {
      const todayYear = (new Date()).getFullYear()
      let imtSalary, ageDetails
      if (todayYear - yearOfBirth >= 35) {
        imtSalary = imt.seniorSalary
        ageDetails = '(35 ans et +)'
      } else {
        imtSalary = imt.juniorSalary
        ageDetails = '(- de 35 ans)'
      }
      if (imtSalary && imtSalary.shortText) {
        return <div style={sectionStyle}>
          Salaires <span style={{fontSize: 10}}>
            {ageDetails}
          </span> : {imtSalary.shortText.toLocaleLowerCase()} brut/mois
        </div>
      }
    }
    if (!salary) {
      return null
    }
    return <div style={sectionStyle}>
      Salaires : {salary.shortText} €/an brut
    </div>
  }

  renderMarketStress() {
    const {imt, sectionStyle} = this.props
    if (!imt || !imt.yearlyAvgOffersDenominator) {
      return null
    }
    const yearlyAvgOffersPer10Candidates = imt.yearlyAvgOffersPer10Candidates ||
      imt.yearlyAvgOffersPer10Openings || 0
    return <div style={sectionStyle}>
      Concurrence : <span style={this.estimateStyle(
          yearlyAvgOffersPer10Candidates, THRESHOLDS.marketStress)}>
        {yearlyAvgOffersPer10Candidates}
      </span> offre{yearlyAvgOffersPer10Candidates > 1 ? 's' : ''} pour <strong>
        {imt.yearlyAvgOffersDenominator}
      </strong> candidat{imt.yearlyAvgOffersDenominator > 1 ? 's' : ''}
    </div>
  }

  renderJobOffersChange() {
    const {jobOffersChange, sectionStyle} = this.props
    if (!jobOffersChange || jobOffersChange <= THRESHOLDS.jobOffersChange.hide) {
      return null
    }
    const plus = jobOffersChange > 0 ? '+' : ''
    const style = this.estimateStyle(jobOffersChange, THRESHOLDS.jobOffersChange)
    return <div style={sectionStyle}>
      Évolution des offres : <span style={style}>{plus}{jobOffersChange}%</span> en un an
    </div>
  }

  renderUnemploymentDuration() {
    const {sectionStyle, unemploymentDuration} = this.props
    if (!unemploymentDuration || !unemploymentDuration.days) {
      return null
    }
    return <div key="unemployment-duration" style={sectionStyle}>
      Temps moyen de retour à l'emploi : <span
        style={this.estimateStyle(-unemploymentDuration.days, THRESHOLDS.unemploymentDuration)}>
        {moment.duration(unemploymentDuration.days, 'days').humanize()}
      </span>
    </div>
  }

  render() {
    return <div style={this.props.style}>
      {this.renderSalary()}
      {this.renderMarketStress()}
      {this.renderJobOffersChange()}
      {this.renderUnemploymentDuration()}
    </div>
  }
}
const JobGroupStats = connect(
  ({user}) => ({yearOfBirth: user.profile.yearOfBirth}))(JobGroupStatsBase)


export {JobGroupStats}
