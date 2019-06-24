import {expect} from 'chai'
import React from 'react'
import {Provider} from 'react-redux'
import ShallowRenderer from 'react-test-renderer/shallow'
import configureStore from 'redux-mock-store'

import {vouvoyer} from 'store/french'
import {ADVICE_MODULES} from 'components/advisor'


const noOp = () => null
const noExplore = () => {
  throw 'onExplore was called during first render'
}

// TODO(cyrille): Make this list vanish.
const methodsMissingTakeAway = new Set([
  'better-job-in-group',
  'improve-interview',
  'seasonal-relocate',
  'specific-to-job',
  'training',
])

// TODO(cyrille): Make this list vanish.
const methodsMissingNewPicto = new Set([
  'specific-to-job',
])

describe('Advice module', () => {
  Object.keys(ADVICE_MODULES).forEach(adviceId => {
    describe(`"${adviceId}"`, () => {
      const advice = ADVICE_MODULES[adviceId]
      const pictoProperty = methodsMissingNewPicto.has(adviceId) ? 'Picto' : 'NewPicto'

      it('has all required properties', () => {
        expect(advice).to.have.property('ExpandedAdviceCardContent')
        if (!methodsMissingTakeAway.has(adviceId)) {
          expect(advice).to.have.property('TakeAway')
        }
        expect(advice).to.have.property(pictoProperty)
      })

      const {ExpandedAdviceCardContent} = advice
      const mockStore = configureStore([])

      it('has an expanded card that renders properly on mobile', () => {
        const store = mockStore({
          app: {
            adviceData: {},
            specificJobs: {},
          },
          user: {},
        })
        new ShallowRenderer().render(<Provider store={store}>
          <ExpandedAdviceCardContent
            advice={{adviceId}}
            dispatch={noOp}
            onExplore={noExplore}
            profile={{}}
            project={{projectId: '0'}}
            isMobileVersion={true}
            userYou={vouvoyer} />
        </Provider>)
      })
    })
  })
})
