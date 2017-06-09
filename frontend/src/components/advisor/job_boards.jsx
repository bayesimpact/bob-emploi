import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import Radium from 'radium'

import {getJobBoards} from 'store/actions'
import {lowerFirstLetter, ofCityPrefix} from 'store/french'

import {AppearingList, CircularProgress, Colors, GrowingNumber, Icon,
  PaddedOnMobile, Styles} from 'components/theme'


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {advice, project} = this.props
    const {isSpecificToJobGroup, isSpecificToRegion, jobBoardTitle} = advice.jobBoardsData || {}
    const {prefix, cityName} = ofCityPrefix(project.mobility.city.name)

    return <div style={{fontSize: 30}}>
      {jobBoardTitle ? <div>
        Connaissez-vous <strong>{jobBoardTitle}</strong>&nbsp;?
        {(isSpecificToJobGroup || isSpecificToRegion) ? <span>
          {' '}Un portail d'offres spécialisé
          {isSpecificToJobGroup ? <span>
            {' '}en <strong>{lowerFirstLetter(project.targetJob.jobGroup.name)}</strong>
          </span> : null}
          {isSpecificToRegion ? <span>
            {' '}dans la région {prefix}<strong>{cityName}</strong>
          </span> : null}.
        </span> : null}
      </div> : <div>
        Et si <strong>la</strong> bonne offre d'emploi se cachait sur un site
        que vous ne connaissez pas encore&nbsp;?
      </div>}
    </div>
  }
}

class AdvicePageContentBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    jobBoards: PropTypes.arrayOf(PropTypes.object.isRequired),
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    const {dispatch, project} = this.props
    dispatch(getJobBoards(project))
  }

  renderJobBoards(style) {
    const {jobBoards} = this.props
    return <AppearingList style={style}>
      {jobBoards.map(({filters, link, title}, index) => <JobBoardLink
          key={`job-board-${index}`} href={link} filters={filters}
          style={{marginTop: index ? -1 : 0}}>
        {title}
      </JobBoardLink>)}
    </AppearingList>
  }

  render() {
    const {jobBoards} = this.props
    if (!jobBoards) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    const numSpecializedJobBoards =
      jobBoards.filter(({filters}) => filters && filters.length).length
    const hasOnlySpecialized = numSpecializedJobBoards === jobBoards.length
    const maybeS = count => count > 1 ? 's' : ''
    const specialized = ` spécialisé${maybeS(numSpecializedJobBoards)}`
    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Nous avons trouvé <GrowingNumber
            style={{fontWeight: 'bold'}} number={jobBoards.length} isSteady={true} />
        {' '}site{maybeS(jobBoards.length)}
        {hasOnlySpecialized ? specialized : null} pour vous
        {(numSpecializedJobBoards > 0 && !hasOnlySpecialized) ? <span>
          dont <GrowingNumber
            style={{fontWeight: 'bold'}} number={numSpecializedJobBoards} isSteady={true} />
          {specialized}</span> : null}
      </PaddedOnMobile>

      {this.renderJobBoards({marginTop: 15})}
    </div>
  }
}
const AdvicePageContent = connect(({app}, {project}) => ({
  jobBoards: app.jobBoards[project.projectId],
}))(AdvicePageContentBase)


class JobBoardLinkBase extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    filters: PropTypes.array,
    href: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  handleClick = () => {
    const {href} = this.props
    window.open(href, '_blank')
  }

  getTags() {
    const {filters, href} = this.props
    const tags = []
    if (/\.pole-emploi\.fr/.test(href)) {
      tags.push({
        color: Colors.SQUASH,
        value: 'officiel',
      })
    }
    if ((filters || []).some(f => /^for-job-group/.test(f))) {
      tags.push({
        color: Colors.GREENISH_TEAL,
        value: 'spécialisé pour votre métier',
      })
    }
    if ((filters || []).some(f => /^for-departement/.test(f))) {
      tags.push({
        color: Colors.SKY_BLUE,
        value: 'spécialisé pour votre région',
      })
    }
    return tags
  }

  render() {
    const {children, style} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      height: 50,
      padding: '0 20px',
      ...style,
    }
    const tagStyle = {
      borderRadius: 2,
      color: '#fff',
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: .3,
      marginLeft: 15,
      padding: 6,
      textTransform: 'uppercase',
    }
    return <div style={containerStyle} onClick={this.handleClick}>
      {children}
      {this.getTags().map(({color, value}) => <span
          key={`tag-${value}`} style={{backgroundColor: color, ...tagStyle}}>
        <div style={Styles.CENTER_FONT_VERTICALLY}>{value}</div>
      </span>)}
      <div style={{flex: 1}} />
      <Icon name="chevron-right" style={{fontSize: 20}} />
    </div>
  }
}
const JobBoardLink = Radium(JobBoardLinkBase)


export default {AdvicePageContent, FullAdviceCard}
