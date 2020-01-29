import React from 'react'
import {Provider} from 'react-redux'
import ShallowRenderer from 'react-test-renderer/shallow'
import configureStore from 'redux-mock-store'

import {vouvoyer} from 'store/french'
import {ADVICE_MODULES} from 'components/advisor'


function noOp<T>(action: T): T {
  return action
}


const raiseOnExplore = (): void => {
  throw 'onExplore was called during first render'
}
const noExplore = (): (() => void) => raiseOnExplore
const noOpTranslate = (text: string): string => text


describe('Advice module', (): void => {
  Object.keys(ADVICE_MODULES).forEach((adviceId): void => {
    describe(`"${adviceId}"`, (): void => {
      const advice = ADVICE_MODULES[adviceId]

      const {ExpandedAdviceCardContent} = advice
      const mockStore = configureStore([])

      it('has an expanded card that renders properly on mobile', (): void => {
        const store = mockStore({
          app: {
            adviceData: {},
            specificJobs: {},
          },
          user: {},
        })
        ShallowRenderer.createRenderer().render(<Provider store={store}>
          <ExpandedAdviceCardContent
            advice={{adviceId}}
            dispatch={noOp}
            handleExplore={noExplore}
            profile={{}}
            project={{projectId: '0'}}
            userYou={vouvoyer}
            t={noOpTranslate} />
        </Provider>)
      })
    })
  })
})
