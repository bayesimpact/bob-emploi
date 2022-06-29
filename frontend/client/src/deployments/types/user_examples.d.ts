import type {LocalizableString} from 'store/i18n'

declare const sampleProfile: bayes.bob.UserProfile
declare const sampleFrustrations: readonly bayes.bob.Frustration[]
declare const sampleProject: bayes.bob.Project
declare const sampleCities: readonly bayes.bob.FrenchCity[]
type JobToLocalize = {
  codeOgr: string
  feminineName?: LocalizableString
  jobGroup: {
    name: LocalizableString
    romeId: string
  }
  masculineName?: LocalizableString
  name: LocalizableString
}
declare const sampleJobs: readonly JobToLocalize[]
// Sample Users for each diagnostic.
declare const sampleUsersPerDiagnostic: {
  readonly [categoryId: string]: Omit<bayes.bob.User, 'projects'> & {
    projects: readonly (Omit<bayes.bob.Project, 'targetJob'> & {
      targetJob?: JobToLocalize
    })[]
  }
}
