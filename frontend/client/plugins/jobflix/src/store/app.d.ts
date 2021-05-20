interface AppState {
  upskillingJobExplored?: [ValidUpskillingJob, string]
  upskillingSections?: {[departementId: string]: readonly bayes.upskilling.Section[]}
  // All jobs for a section once we have fetched more jobs for it from the server.
  upskillingSectionAllJobs?: {[departementId: string]: {
    [sectionId: string]: readonly bayes.upskilling.Job[]
  }}
  upskillingSelectedJobs?: readonly ValidUpskillingJob[]
  upskillingStarredSections?: {[sectionId: string]: true}
}
