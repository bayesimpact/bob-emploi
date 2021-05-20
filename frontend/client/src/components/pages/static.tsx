import React from 'react'
import {Route, Switch} from 'react-router-dom'

import {Routes} from 'components/url'

import Contribution from './static/contribution'
import Cookies from './static/cookies'
import Covid from './static/covid'
import Partners from './static/partners'
import Privacy from './static/privacy'
import Transparency from './static/transparency'
import Team from './static/team'
import Professionals from './static/professionals'
import VideoSignup from './static/video_signup'
import Terms from './static/terms'
import Vision from './static/vision'
import StaticAdvice from './static/static_advice'

const StaticPages = (): React.ReactElement => <Switch>
  <Route path={Routes.CONTRIBUTION_PAGE} component={Contribution} />
  <Route path={Routes.COOKIES_PAGE} component={Cookies} />
  <Route path={Routes.COVID_PAGE} component={Covid} />
  <Route path={Routes.PARTNERS_PAGE} component={Partners} />
  <Route path={Routes.PRIVACY_PAGE} component={Privacy} />
  <Route path={Routes.TRANSPARENCY_PAGE} component={Transparency} />
  <Route path={Routes.TEAM_PAGE} component={Team} />
  <Route path={Routes.PROFESSIONALS_PAGE} component={Professionals} />
  <Route path={Routes.VIDEO_SIGNUP_PAGE} component={VideoSignup} />
  <Route path={Routes.TERMS_AND_CONDITIONS_PAGE} component={Terms} />
  <Route path={Routes.VISION_PAGE} component={Vision} />
  <Route path={Routes.STATIC_ADVICE_PATH} component={StaticAdvice} />
</Switch>


export default React.memo(StaticPages)
