// Fetch the dossier ID from URL. URL looks like "https://portail.i-milo.fr/dossier/123456/..."
export const getDossierId = (pathname = location.pathname): string =>
  (pathname.match(/^\/dossier\/(\d+)/) || [])[1]

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response) {
    throw new Error(`Unable to fetch "${url}"`)
  }
  return await response.json()
}
export const getUserInfo = (dossierId: string): Promise<UserInfo> =>
  getJson(`/records/api/dossier/${dossierId}`)

export const getCounselorInfo = (): Promise<CounselorInfo> =>
  getJson('/auth/api/sso/user/current')

export const getCounselorStructures = (): Promise<CounselorStructures> =>
  getJson('/auth/api/sso/user/current/structures')

export const getPolicies = (dossierId: string): Promise<readonly PolicyInfo[]> =>
  getJson(`/policies/api/basePolicyInstance/parDossier/exceptGrtWithPacea?recordId=${dossierId}`)
// Create a task in the young person's dossier in i-milo.
// TODO(cyrille): Consider using a "commentaire" instead.
export const createTask = async (task: TaskRequest): Promise<void> => {
  await fetch('/addresses/api/note/tache/dossier', {
    body: JSON.stringify(task),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'post',
  })
}

