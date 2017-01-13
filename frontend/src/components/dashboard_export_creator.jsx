import React from 'react'
import {connect} from 'react-redux'


function postOpen(url, target) {
  var form = document.createElement('form')
  form.setAttribute('method', 'post')
  form.setAttribute('action', url)
  form.setAttribute('target', target)
  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
}


class DashboardExportCreatorBase extends React.Component {
  static propTypes = {
    children: React.PropTypes.node,
    dispatch: React.PropTypes.func.isRequired,
    userId: React.PropTypes.string.isRequired,
  }

  handleClick = event => {
    event.stopPropagation()
    postOpen('/api/dashboard-export/open/' + this.props.userId)
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {children, dispatch, userId, ...otherProps} = this.props
    return <div {...otherProps} onClick={this.handleClick}>
      {children}
    </div>
  }

}
const DashboardExportCreator = connect(({user}) => ({userId: user.userId}))(
    DashboardExportCreatorBase)


export {DashboardExportCreator}
