import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {Route, Switch} from 'react-router-dom'

import {GET_MAYDAY_HELPER_COUNT, getMaydayHelperCount} from 'store/actions'

import {PieChart} from 'components/theme'
import {Routes} from 'components/url'
import helpCoffeeImageSet from 'images/mayday/help-coffee.png?multi&sizes[]=400&sizes[]=275'
import helpCoverLetterImageSet
  from 'images/mayday/help-cover-letter.png?multi&sizes[]=400&sizes[]=275'
import helpResumeImageSet from 'images/mayday/help-resume.png?multi&sizes[]=400&sizes[]=275'
import helpTrainBobImageSet from 'images/mayday/help-train-bob.png?multi&sizes[]=400&sizes[]=275'
import partyIcon from 'images/party.png'

import actions from './mayday/actions.json'
import {CoffeePage} from './mayday/coffee_page'
import {StationDisplay} from './mayday/gauge'
import {WaitingPage} from './waiting'

require('normalize.css')
require('styles/App.css')

const imageSets = {
  HELP_COFFEE: helpCoffeeImageSet,
  HELP_COVER_LETTER: helpCoverLetterImageSet,
  HELP_RESUME: helpResumeImageSet,
  HELP_TRAIN_ALGO: helpTrainBobImageSet,
}

const centeredStyle = {
  margin: 'auto',
  maxWidth: 600,
}


class MayDayOverPageBase extends React.Component {
  static propTypes = {
    counts: PropTypes.shape({
      actionHelperCount: PropTypes.objectOf(PropTypes.number.isRequired).isRequired,
      totalHelperCount: PropTypes.number.isRequired,
    }),
    dispatch: PropTypes.func.isRequired,
    isFetching: PropTypes.bool.isRequired,
  }

  componentDidMount() {
    const {dispatch, counts, isFetching} = this.props
    if (!counts && !isFetching) {
      dispatch(getMaydayHelperCount())
    }
  }

  renderActionResult = ({id, title}) => {
    const {counts: {actionHelperCount, totalHelperCount}} = this.props
    const percent = Math.round(actionHelperCount[id] / totalHelperCount * 100)
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      margin: '25px auto 0',
      maxWidth: 290,
    }
    const imageStyle = {
      border: '5px solid #fff',
      borderRadius: 10,
      width: containerStyle.maxWidth / 2,
    }
    const pieChartStyle = {
      border: 'solid 1px rgba(255, 255, 255, 0.5)',
      borderRadius: 32,
      bottom: 0,
      boxShadow: '0 3px 6px 0 rgba(0, 0, 0, 0.5)',
      color: '#fff',
      left: 0,
      margin: 'auto',
      position: 'absolute',
      right: 0,
      top: 0,
    }
    return <div key={id} style={containerStyle}>
      <div style={{flex: 1, position: 'relative'}}>
        <img alt={id} src={imageSets[id].images[0].path} style={imageStyle} />
        <PieChart
          strokeWidth={32} size={32}
          backgroundColor="rgba(255, 255, 255, 0.3)" percentage={percent} style={pieChartStyle} />
      </div>
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: 32, fontWeight: 'bold'}}>{percent}%</div>
        <div style={{}}>{title}</div>
      </div>
    </div>
  }

  render() {
    if (!this.props.counts) {
      return <WaitingPage />
    }
    const containerStyle = {
      backgroundColor: colors.BOB_BLUE,
      color: '#fff',
      fontSize: 13,
      minHeight: '100vh',
      padding: '20px 10px',
      textAlign: 'center',
    }
    const stationDisplayGaugeStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      fontWeight: 'bold',
      justifyContent: 'center',
      padding: '20px 0',
    }
    const {counts: {totalHelperCount}} = this.props
    return <div style={{fontFamily: 'Lato, Helvetica'}}>
      <div style={containerStyle}>
        <h1 style={{...centeredStyle, padding: '17px 0 24px'}}>
          Merci de votre participation&nbsp;!
        </h1>
        <div style={stationDisplayGaugeStyle}>
          <StationDisplay height={70} style={{marginBottom: 12}}>
            {'' + totalHelperCount}
          </StationDisplay>
          <div>Bob Actions ont été lancées</div>
        </div>
        <h2 style={{margin: '33px 0 0'}}>Répartition des Bob Actions</h2>
        {actions.map(this.renderActionResult)}
      </div>
    </div>
  }
}
const MayDayOverPage = connect(({app: {maydayData: counts}, asyncState: {isFetching}}) => ({
  counts,
  isFetching: !!isFetching[GET_MAYDAY_HELPER_COUNT],
}))(MayDayOverPageBase)


class ThankYouPage extends React.Component {
  render() {
    const style = {
      backgroundColor: colors.BOB_BLUE,
      color: '#fff',
      fontSize: 14,
      minHeight: '100vh',
      padding: '20px 10px',
      textAlign: 'center',
    }
    return <div style={style}>
      <div style={{position: 'relative'}}>
        <h1 style={{fontSize: 35, lineHeight: 1, margin: '0 -10px'}}>
          Merci pour votre engagement&nbsp;!
        </h1>
        <p style={{margin: '20px auto 0', maxWidth: 200}}>
          <strong>On vous recontacte par email dans les meilleurs délais&nbsp;!</strong>
        </p>
        <img src={partyIcon} alt="" style={{margin: '25px auto', maxWidth: 95}} />
      </div>
    </div>
  }
}


class MayDayPage extends React.Component {
  // TODO(cyrille): Clean-up few months after the campaign is over.
  render() {
    // TODO(pascal): Propagate font family to children that still needs GTWalsheim.
    return <div style={{fontFamily: 'GTWalsheim'}}>
      <Switch>
        <Route path={`${Routes.MAYDAY_THANK_YOU_PAGE}`} component={ThankYouPage} />} />
        <Route path={`${Routes.MAYDAY_COFFEE_PAGE}`} component={CoffeePage} />} />
        <Route path="*" component={MayDayOverPage} />
      </Switch>
    </div>
  }
}


// imageSets exported for test purposes only.
export {imageSets, MayDayPage}
