import React from 'react'
import {connect} from 'react-redux'
import Radium from 'radium'
import VisibilitySensor from 'react-visibility-sensor'

import {getJobBoards} from 'store/actions'

import {CircularProgress} from 'components/progress'
import {Colors, GrowingNumber, Icon, PaddedOnMobile} from 'components/theme'

import {AdviceCard} from './base'


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
  }

  render() {
    const strongStyle = {
      color: Colors.SKY_BLUE,
      fontSize: 40,
    }
    const reasons = ['JUST_STARTED_SEARCHING', 'LESS_THAN_15_OFFERS', 'NO_OFFERS']
    const {jobBoardTitle} = this.props.advice.jobBoardsData || {}
    return <AdviceCard {...this.props} reasons={reasons}>
      <div style={{alignItems: 'center', fontSize: 30, lineHeight: '1.8em'}}>
        <div>
          Connaissez-vous {jobBoardTitle || 'Régions Jobs'} ?
        </div>
        <div>
          Plus de <strong style={strongStyle}>
            <GrowingNumber number={1500} isSteady={true} />
          </strong> Job boards existent en France
        </div>
      </div>
    </AdviceCard>
  }
}

class AdvicePageContentBase extends React.Component {
  static propTypes = {
    dispatch: React.PropTypes.func.isRequired,
    jobBoards: React.PropTypes.arrayOf(React.PropTypes.object.isRequired),
    project: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  state = {
    isShown: false,
  }

  componentWillMount() {
    const {dispatch, project} = this.props
    dispatch(getJobBoards(project))
  }

  renderJobBoards(style) {
    const {jobBoards} = this.props
    const {isShown} = this.state
    const jobBoardStyle = index => ({
      opacity: isShown ? 1 : 0,
      transition: `opacity 300ms ease-in ${index * 700 / jobBoards.length}ms`,
    })
    return <div style={style}>
      <VisibilitySensor
          active={!isShown} intervalDelay={250}
          onChange={isShown => this.setState({isShown})} />
      {jobBoards.map(({link, title}, index) => <JobBoardLink
          key={`job-board-${index}`} style={jobBoardStyle(index)} href={link}>
        {title}
      </JobBoardLink>)}
    </div>
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
        dont <GrowingNumber
            style={{fontWeight: 'bold'}} number={numSpecializedJobBoards} isSteady={true} />
        {' '}spécialisé{maybeS(numSpecializedJobBoards)}
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
    children: React.PropTypes.node,
    href: React.PropTypes.string.isRequired,
    style: React.PropTypes.object,
  }

  handleClick = () => {
    const {href} = this.props
    window.open(href, '_blank')
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
    return <div style={containerStyle} onClick={this.handleClick}>
      <div style={{flex: 1}}>
        {children}
      </div>
      {/* TODO(pascal): Add tags. */}
      <Icon name="chevron-right" style={{fontSize: 20}} />
    </div>
  }
}
const JobBoardLink = Radium(JobBoardLinkBase)


export default {AdvicePageContent, FullAdviceCard}
