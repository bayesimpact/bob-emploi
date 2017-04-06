import React from 'react'
import ReactHeight from 'react-height'
import {browserHistory} from 'react-router'

import {JobGroupStats} from 'components/job'
import {Routes} from 'components/url'

import {Colors, Icon, Button, Styles} from 'components/theme'


class ProjectCard extends React.Component {
  static propTypes = {
    project: React.PropTypes.shape({
      actions: React.PropTypes.array,
      pastActions: React.PropTypes.array,
      projectId: React.PropTypes.string,
      title: React.PropTypes.string.isRequired,
    }).isRequired,
    style: React.PropTypes.object,
  }

  componentWillMount() {
    const {actions, pastActions} = this.props.project
    const hasPastActions = pastActions && pastActions.length
    const actionRead = action => action.status !== 'ACTION_UNREAD'
    const hasOnlyUnreadActions = !(actions || []).filter(actionRead).length
    this.setState({
      areStatsExpanded: !hasPastActions && hasOnlyUnreadActions,
      height: 0,
    })
  }

  render() {
    const {project, style} = this.props
    const {areStatsExpanded, height} = this.state
    const containerStyle = {
      ...style,
    }
    const blockStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      borderRadius: '0 0 2px 2px',
      boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.04)',
      color: Colors.CHARCOAL_GREY,
    }
    const headlineStyle = {
      ...blockStyle,
      alignItems: 'center',
      borderRadius: project.localStats ? '2px 2px 0 0' : 2,
      display: 'flex',
      fontSize: 14,
      fontWeight: 500,
      marginBottom: 1,
      padding: 20,
    }
    const statsHeaderStyle = {
      alignItems: 'center',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: .5,
      padding: '5px 20px',
      textTransform: 'uppercase',
    }
    const statsContainerStyle = {
      maxHeight: (height && project.localStats) ? (areStatsExpanded ? height : 0) : 'initial',
      opacity: areStatsExpanded ? 1 : 0,
      overflow: 'hidden',
      transition: '100ms',
    }
    const separatorStyle = {
      backgroundColor: Colors.MODAL_PROJECT_GREY,
      border: 'none',
      height: 1,
      margin: '0 20px',
    }
    return <div style={containerStyle}>
      <div style={headlineStyle}>
        <div style={{flex: 1, ...Styles.CENTER_FONT_VERTICALLY}}>{project.title}</div>
        <Button
            isNarrow={true}
            onClick={() => browserHistory.push(Routes.PROJECT_PAGE + '/' + project.projectId)}>
          Voir
        </Button>
      </div>

      {project.localStats ? <div style={blockStyle}>
        <header
            style={statsHeaderStyle}
            onClick={() => this.setState({areStatsExpanded: !areStatsExpanded})}>
          <span style={{flex: 1}}>
            Informations sur le métier
          </span>
          <Icon
              name={'menu-' + (areStatsExpanded ? 'up' : 'down')}
              style={{color: Colors.COOL_GREY, fontSize: 24}} />
        </header>
        {areStatsExpanded ? <hr style={separatorStyle} /> : null}
        <div style={statsContainerStyle}>
          <ReactHeight onHeightReady={height => this.setState({height})}>
            <JobGroupStats
                {...project.localStats} style={{fontSize: 14, lineHeight: 2, padding: 20}} />
          </ReactHeight>
        </div>
      </div> : null}
    </div>
  }
}


export {ProjectCard}
