import {registerStaticAdviceModule} from 'components/static'

import AssociationHelp from './association_help'
import Events from './events'
import Interview from './interview'
import MotivationLetter from './motivation_letter'
import Offers from './offers'
import Relocate from './relocate'
import Resume from './resume'
import SelfConfidence from './confidence'
import Skills from './skills'

function registerAllStaticAdviceModules(): void {
  registerStaticAdviceModule(AssociationHelp)
  registerStaticAdviceModule(Events)
  registerStaticAdviceModule(Interview)
  registerStaticAdviceModule(MotivationLetter)
  registerStaticAdviceModule(Offers)
  registerStaticAdviceModule(Relocate)
  registerStaticAdviceModule(Resume)
  registerStaticAdviceModule(SelfConfidence)
  registerStaticAdviceModule(Skills)
}

export default registerAllStaticAdviceModules
