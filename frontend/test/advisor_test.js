import {expect} from 'chai'
import _forEach from 'lodash/forEach'
import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import configureStore from 'redux-mock-store'

import {ADVICE_MODULES} from 'components/advisor'


describe('Advice module', () => {
  _forEach(ADVICE_MODULES, (advice, adviceId) => {
    describe(`"${adviceId}"`, () => {

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
        new ShallowRenderer().render(<ExpandedAdviceCardContent
          advice={{adviceId}}
          dispatch={() => null}
          onExplore={() => {
            throw 'onExplore was called during first render'
          }}
          profile={{}}
          project={{projectId: '0'}}
          isMobileVersion={true}
          store={store}
          userYou={(tu, vous) => vous}
        />)
      })
    })
  })
})
