import React from 'react'
import {Scrollbars} from 'react-custom-scrollbars'
import _ from 'underscore'

import {actionHistoryDate} from 'store/action'
import {readableDay} from 'store/french'

import {Colors, RoundButton} from 'components/theme'
import {DashboardExportCreator} from 'components/dashboard_export_creator'
import {Modal, ModalHeader} from 'components/modal'
import {Action} from 'components/actions'


class ActionsHistory extends React.Component {
  static propTypes = {
    actionsAndProjects: React.PropTypes.arrayOf(React.PropTypes.object.isRequired).isRequired,
    onOpenAction: React.PropTypes.func.isRequired,
  }

  render() {
    const {actionsAndProjects, onOpenAction, ...extraProps} = this.props
    const containerStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      width: 700,
    }
    const historyStyle = {
      paddingBottom: 5,
    }
    const maxHeight = window.innerHeight - 200
    const dayStyle = {
      color: Colors.COOL_GREY,
      fontSize: 12,
      fontWeight: 500,
      textAlign: 'center',
    }
    const scrollbarStyle = {
      backgroundColor: Colors.SILVER,
      borderRadius: 100,
      cursor: 'pointer',
      width: 6,
    }
    const footerStyle = {
      color: Colors.COOL_GREY,
      cursor: 'pointer',
      padding: '14px 9px 12px',
      textAlign: 'right',
    }
    const actionsGrouped = _.groupBy(actionsAndProjects, ({action}) => actionHistoryDate(action))
    const days = Object.keys(actionsGrouped).sort().reverse()
    return <Modal {...extraProps} style={containerStyle}>
      <ModalHeader style={{justifyContent: 'center'}}>
        Historique des actions effectuées
      </ModalHeader>
      <Scrollbars
          style={historyStyle} autoHeight autoHeightMax={maxHeight}
          renderThumbVertical={({style, ...props}) =>
            <div {...props} style={{...style, ...scrollbarStyle}} />}>
        {days.map(day => <div key={day} style={{padding: '30px 30px 0'}}>
          <div style={dayStyle}>
            {readableDay(day)}
          </div>
          <div>
            {actionsGrouped[day].map(({action, project}) => <Action
                key={action.actionId} action={action} project={project}
                context="project" onOpen={() => onOpenAction(action)} />)}
          </div>
        </div>)}
      </Scrollbars>
      <footer style={{display: 'flex', flexDirection: 'row-reverse'}}>
        <DashboardExportCreator style={footerStyle}>
          <RoundButton type="discreet" isNarrow={true}>
            Partager mon activité
          </RoundButton>
        </DashboardExportCreator>
      </footer>
    </Modal>
  }
}


export {ActionsHistory}
