import React, {useCallback, useState} from 'react'
import {useDispatch} from 'react-redux'

import {DispatchAllActions, displayToasterMessage} from 'store/actions'

import BookmarkletInstallation from 'components/bookmarklet_installation'
import Button from 'components/button'
import Textarea from 'components/textarea'
import {MAX_CONTENT_WIDTH} from 'components/theme'
import {Routes} from 'components/url'

import addingBookmarkletGif from './import-from-imilo/adding-imilo-bookmarklet.gif'
import usingBookmarkletGif from './import-from-imilo/import-from-imilo.gif'


const initialUserJson = JSON.stringify({
  profile: {
    familySituation: 'SINGLE_PARENT_SITUATION',
    frustrations: [
      'NO_OFFERS',
      'SELF_CONFIDENCE',
      'TIME_MANAGEMENT',
      'EXPERIENCE',
      'ATYPIC_PROFILE',
      'AGE_DISCRIMINATION',
      'SEX_DISCRIMINATION',
    ],
    gender: 'FEMININE',
    hasCarDrivingLicense: true,
    highestDegree: 'NO_DEGREE',
    lastName: 'Dupont',
    name: 'Angèle',
    yearOfBirth: 1999,
  },
  projects: [{
    areaType: 'CITY',
    city: {
      cityId: '32208',
      departementId: '32',
      departementName: 'Gers',
      name: 'Lectoure',
      postcodes: '32700',
      regionId: '76',
      regionName: 'Occitanie',
    },
    employmentTypes: ['CDI'],
    // 11 months ago.
    jobSearchStartedAt: new Date(Date.now() - 86_400_000 * 30.5 * 11).toISOString(),
    kind: 'FIND_A_NEW_JOB',
    passionateLevel: 'ALIMENTARY_JOB',
    previousJobSimilarity: 'DONE_SIMILAR',
    targetJob: {
      codeOgr: '11573',
      feminineName: 'Boulangère',
      jobGroup: {
        name: 'Boulangerie - viennoiserie',
        romeId: 'D1102',
      },
    },
    totalInterviewCount: 13,
    trainingFulfillmentEstimate: 'ENOUGH_DIPLOMAS',
    weeklyApplicationsEstimate: 'SOME',
    weeklyOffersEstimate: 'DECENT_AMOUNT',
    workloads: ['FULL_TIME'],
  }],
}, undefined, 2)

// TODO(florian): Make mobile friendly if necessary (not likely as i-milo is not
// mobile friendly).
const textSectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  fontSize: 16,
  lineHeight: 1.63,
  paddingBottom: 50,
}
const titleStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 'bold',
  lineHeight: 1,
  maxWidth: MAX_CONTENT_WIDTH,
  padding: '50px 0 40px',
  textAlign: 'center',
}

const bootstrapBookmarklet = {
  entry: 'import-from-imilo',
  functionName: 'bob2imilo',
  title: `Conseils de ${config.productName}`,
}

const ImiloIntegrationPageBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const [userJson, setUserJson] = useState(initialUserJson)

  const getUserData = useCallback((): bayes.bob.User|null => {
    try {
      return JSON.parse(userJson.replace(/ObjectId\(("[\da-f]+")\)/, '$1'))
    } catch (error) {
      dispatch(displayToasterMessage(error.toString()))
      return null
    }
  }, [dispatch, userJson])

  const bootstrapAdvice = useCallback((): void => {
    const userData = getUserData()
    if (!userData) {
      return
    }
    const url = `${Routes.BOOTSTRAP_PAGE}#${encodeURIComponent(JSON.stringify(userData))}`
    window.open(url, '_blank')
  }, [getUserData])

  return <BookmarkletInstallation
    goal={`obtenir les conseils de ${config.productName}`}
    bookmarklet={bootstrapBookmarklet} page="imilo-integration"
    installDemo={addingBookmarkletGif} usageDemo={usingBookmarkletGif}>
    <div style={textSectionStyle}>
      <div style={titleStyle}>
        Tester l'interface
      </div>
      <Textarea
        value={userJson} onChange={setUserJson}
        style={{fontFamily: 'Monospace', fontSize: 12, height: 600, margin: 'auto', width: 800}}
      />
      <div style={{marginTop: 20, textAlign: 'center'}}>
        <Button onClick={bootstrapAdvice}>
          Trouver des conseils
        </Button>
      </div>
    </div>
  </BookmarkletInstallation>
}
const ImiloIntegrationPage = React.memo(ImiloIntegrationPageBase)

export default ImiloIntegrationPage
