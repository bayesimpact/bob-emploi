import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import _ from 'underscore'

import {Action} from 'components/actions'
import {getDashboardExport, GET_DASHBOARD_EXPORT} from 'store/actions'
import {allDoneActions, PROJECT_LOCATION_AREA_TYPE_OPTIONS,
        PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_WORKLOAD_OPTIONS} from 'store/project'
import {CircularProgress, JobGroupCoverImage, HorizontalRule} from 'components/theme'

const areaTypeOptions = _.indexBy(PROJECT_LOCATION_AREA_TYPE_OPTIONS, 'value')
const employmentTypeOptions = _.indexBy(PROJECT_EMPLOYMENT_TYPE_OPTIONS, 'value')
const workloadOptions = _.indexBy(PROJECT_WORKLOAD_OPTIONS, 'value')

class ProjectSummary extends React.Component {
  static propTypes = {
    allChantiers: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {allChantiers, project} = this.props
    const containerStyle = {
      backgroundColor: '#fff',
      boxShadow: '0 0 23px 0 rgba(0, 0, 0, 0.12)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      marginBottom: 30,
    }
    const headerStyle = {
      color: '#fff',
      paddingBottom: 20,
      position: 'relative',
      textShadow: '0 0 4px rgba(0, 0, 0, 0.5)',
      zIndex: 0,
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      fontSize: 30,
      fontWeight: 'bold',
      justifyContent: 'center',
      letterSpacing: 3,
      lineHeight: 1.26,
      paddingTop: 20,
      textAlign: 'center',
    }
    const subtitleStyle = {
      flex: 1,
      fontSize: 20,
      fontWeight: 'normal',
      letterSpacing: .6,
      padding: '0 41px',
    }
    const contentStyle = {
      backgroundColor: '#fff',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      fontSize: 16,
      lineHeight: 1.44,
      padding: '0 41px 41px',
    }
    const hasActiveChantiers = _.any(_.values(project.activatedChantiers))
    return <div style={containerStyle}>
      <div style={headerStyle}>
        <JobGroupCoverImage romeId={project.targetJob.jobGroup.romeId} style={{zIndex: -1}} />
        <div style={titleStyle}>{project.title}</div>
        <HorizontalRule />
        <div style={subtitleStyle}>
          <div>Mobilité : {areaTypeOptions[project.mobility.areaType].name}</div>
          <div>
            <span>Type de contrat : </span>
            {(project.employmentTypes || []).map(employmentType => {
              return employmentTypeOptions[employmentType].name
            }).join(', ')}
          </div>
          {project.minSalary ? (
            <div>Attente de salaire : {project.minSalary} € brut par ann</div>
          ) : null}
          <div>
            <span>Temps plein ou partiel : </span>
            {(project.workloads || []).map(workload => workloadOptions[workload].name).join(', ')}
          </div>
        </div>
      </div>
      {hasActiveChantiers ? <div style={contentStyle}>
        <h3>Solutions sélectionnées :</h3>
        <ul>
          {_.map(project.activatedChantiers, (activated, chantierId) => {
            return activated ? <li key={chantierId}>{allChantiers[chantierId].title}</li> : null
          })}
        </ul>
      </div> : null}
    </div>
  }
}

class DashboardExportPageBase extends React.Component {
  static propTypes = {
    dashboardExport: PropTypes.object,
    dispatch: PropTypes.func.isRequired,
    isFetching: PropTypes.bool,
    params: PropTypes.shape({
      dashboardExportId: PropTypes.string.isRequired,
    }),
  }

  componentWillMount() {
    const {dashboardExportId} = this.props.params
    const {dashboardExport, isFetching} = this.props
    if (!dashboardExport && !isFetching) {
      this.props.dispatch(getDashboardExport(dashboardExportId))
    }
  }

  render() {
    const {dashboardExport, isFetching, params} = this.props
    if (!dashboardExport && !isFetching) {
      return <div>
        {`Impossible de trouver le document ${params.dashboardExportId}`}
      </div>
    }
    const style = {
      padding: 50,
    }
    const allActions = allDoneActions(dashboardExport.projects)
    return <div style={style}>
      <h1>Export de l'historique des actions</h1>
      <p>
        Vous pouvez partager cet historique en donnant l'adresse
        unique de cette page web. Seules les personnes qui auront ce lien unique
        pourront y accéder !
      </p>
      {isFetching ? <CircularProgress /> : <div>
        <h2>Projets:</h2>
        {dashboardExport.projects.map(project => {
          return <ProjectSummary
              key={project.projectId} project={project} allChantiers={dashboardExport.chantiers} />
        })}
        {allActions.length ? <div>
          <h2 style={{marginTop: 30}}>Historique des actions pour ce projet :</h2>
          <ol>
            {_.map(allActions, action => {
              return <Action action={action} project={action.project} key={action.actionId} />
            })}
          </ol>
        </div> : null}
      </div>}
    </div>
  }
}
const DashboardExportPage = connect(({app, asyncState, user}, {params}) => ({
  dashboardExport: app.dashboardExports[params.dashboardExportId],
  isFetching: asyncState.isFetching[GET_DASHBOARD_EXPORT],
  userProfile: user.profile,
}))(DashboardExportPageBase)

export {DashboardExportPage}
