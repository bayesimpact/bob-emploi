import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import Radium from 'radium'

import {getJobBoards} from 'store/actions'

import {CircularProgress} from 'components/progress'
import {AppearingList, Colors, GrowingNumber, Icon, PaddedOnMobile, PieChart,
  Styles} from 'components/theme'


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const strongStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 40,
    }
    const {jobBoardTitle} = this.props.advice.jobBoardsData || {}
    return <div style={{display: 'flex', fontSize: 13}}>
      <div style={{alignItems: 'center', flex: 1, fontSize: 30, lineHeight: '1.8em'}}>
        <div>
          Connaissez-vous {jobBoardTitle || 'Régions Jobs'} ?
        </div>
        <div>
          Plus de <strong style={strongStyle}>
            <GrowingNumber number={1500} isSteady={true} />
          </strong> Job boards existent en France
        </div>
      </div>
      {isMobileVersion ? null : <div style={{textAlign: 'center', width: 150}}>
        <PieChart
            percentage={80} style={{color: Colors.SKY_BLUE, margin: 'auto'}}
            backgroundColor={Colors.MODAL_PROJECT_GREY}>
          <GrowingNumber number={80} />%
        </PieChart>
        <div style={{color: Colors.DARK_TWO, marginTop: 15}}>
          des chercheurs consultent des annonces
        </div>
      </div>}
      {isMobileVersion ? null : <div style={{textAlign: 'center', width: 150}}>
        <PieChart
            percentage={40} style={{color: Colors.SKY_BLUE, margin: 'auto'}}
            backgroundColor={Colors.MODAL_PROJECT_GREY}>
          <GrowingNumber number={40} />%
        </PieChart>
        <div style={{color: Colors.DARK_TWO, marginTop: 15}}>
          y répondent vraiment
        </div>
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
          key={`job-board-${index}`} href={link} filters={filters}>
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
    const maybeS = count => count > 1 ? 's' : ''
    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Nous avons trouvé <GrowingNumber
            style={{fontWeight: 'bold'}} number={jobBoards.length} isSteady={true} />
        {' '}site{maybeS(jobBoards.length)} pour vous
        {numSpecializedJobBoards > 0 ? <span>dont <GrowingNumber
            style={{fontWeight: 'bold'}} number={numSpecializedJobBoards} isSteady={true} />
          {' '}spécialisé{maybeS(numSpecializedJobBoards)}</span> : null}
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
        border: `solid 1px ${Colors.COOL_GREY}`,
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
