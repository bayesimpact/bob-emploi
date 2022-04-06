interface AppState {
  // Last coaching started: for each job group ID, keeps the last email that was used to start
  // a coaching.
  // Do NOT persist on server or in Web Storage.
  upskillingCoachingStarted?: Record<string, string>
  upskillingEvaluatedJobs?: readonly ValidUpskillingJob[]
  upskillingEvaluatingJob?: [ValidUpskillingJob, string]
  upskillingIsCityPersistent?: boolean
  upskillingJobExplored?: [ValidUpskillingJob, string]
  upskillingSections?: {[departementId: string]: readonly bayes.upskilling.Section[]}
  // All jobs for a section once we have fetched more jobs for it from the server.
  upskillingSectionAllJobs?: {[departementId: string]: {
    [sectionId: string]: readonly bayes.upskilling.Job[]
  }}
  upskillingSelectedJobs?: readonly ValidUpskillingJob[]
  upskillingStarredSections?: {[sectionId: string]: true}
  upskillingJobForCoaching?: [ValidUpskillingJob, string, 'after-save' | 'job-details']
}
