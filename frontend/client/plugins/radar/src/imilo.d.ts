// Declaration file for the i-milo types.

// The i-milo application enriches the window with a lot of information, under `window.App`
interface IMiloJsApp {
  Security: Security
}

interface Security {
  // The ID for the administrative structure of the logged-in user, e.g. "510".
  structureId: string
}

interface UserInfo {
  // The official referent counselor for the young person.
  fullReferent: null|{id: number}
  // An official code for the level of studies of the young person.
  // For reference, see https://www.gard.gouv.fr/content/download/27668/197908/file/2%20Annexe%201dipl%c3%b4mes%20niveau%20brevet%20minimum.pdf
  fullSchoolLevel: null|{code: string}
  // The dossier ID, that uniquely identifies the young person.
  id: number
  // Personal information about the young person. PII included, handle with care!
  identity: null|{
    // Date of birth of the young person, in DD/MM/YYYY format.
    birthDate: string
  }
  // Unique identifier for the specific MiLo agency the user is registered at, e.g. 7106 for St Lô.
  // It may be different from the one for the counselor.
  structure: null|number
}

interface CounselorInfo {
  // The counselor's email address.
  email: string

  // The counselor's ID in i-milo.
  id: number
}

interface PolicyInfo {
  policy: {
    // The name of the policy the young person is in. E.g. "Garantie jeunes" or "PACEA"
    name: string
  }
  // Whether this policy is currently running or closed for this young person.
  status: 'CLOSED' | 'RUNNING'
}
// A task is a time-sensitive note that can be saved to the young person's dossier in SI-Milo
// (the i-milo database).
// We use it to keep a reminder for taking new photos after a certain amount of time has elapsed.
// TODO(cyrille): Make sure this is the best way to keep track of the product in i-MiLo.
interface TaskRequest {
  // TODO(cyrille): Determine what this is for.
  adminStructure: string
  // The specific content of this task.
  content: string
  // The date at which the task should be done, in DD/MM/YYYY format.
  deadLine: string
  // The dossier ID
  linkObjectId: number
  // A short title for the task, to be easily recognized.
  title: string
  // The counselor ID.
  userId: number
}
