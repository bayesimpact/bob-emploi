import {expect} from 'chai'
import React from 'react'
import {Provider} from 'react-redux'
import ShallowRenderer from 'react-test-renderer/shallow'
import configureStore from 'redux-mock-store'

import {ADVICE_MODULES} from 'components/advisor'


describe('Advice module', () => {
  Object.keys(ADVICE_MODULES).forEach(adviceId => {
    describe(`"${adviceId}"`, () => {
      const advice = ADVICE_MODULES[adviceId]

      it('has all required properties', () => {
        expect(advice).to.have.property('ExpandedAdviceCardContent')
        expect(advice).to.have.property('Picto')
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
            dispatch={() => null}
            onExplore={() => {
              throw 'onExplore was called during first render'
            }}
            profile={{}}
            project={{projectId: '0'}}
            isMobileVersion={true}
            userYou={(tu, vous) => vous} />
        </Provider>)
      })
    })
  })
})
