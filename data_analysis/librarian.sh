# Script to send a link to a random notebook to a Slack channel. It needs to
# run from a git folder where the "origin" remote is linked to the GitHub repo.
#
# It requiers a SLACK_URL env var, which should be set to a Slack Webhook URL.
# See https://bayesimpact.slack.com/services/240954714432
#
# TODO(pascal): Use the GitHub API so that this script can run in the cloud.
pushd "$(dirname "$0")/notebooks" > /dev/null

readonly GIT_REMOTE="origin"
readonly GIT_REMOTE_BRANCH="main"

readonly NOTEBOOK_FOLDER="$(git rev-parse --show-prefix)"
readonly RANDOM_NOTEBOOK="$(\
  git ls-tree -r --name-only "${GIT_REMOTE}/${GIT_REMOTE_BRANCH}" . |\
  grep ipynb$ | grep -v checkpoints/ |\
  sort -R | head -n 1)"

readonly GITHUB_REPOS="$(git remote get-url "${GIT_REMOTE}" | sed -e "s/^.*://;s/.git$//")"

readonly NOTEBOOK_URL="https://github.com/${GITHUB_REPOS}/tree/${GIT_REMOTE_BRANCH}/${NOTEBOOK_FOLDER}/${RANDOM_NOTEBOOK}"

wget -o /dev/null -O /dev/null \
  --post-data="{\"text\": \"Re-discover this notebook: <${NOTEBOOK_URL}|${RANDOM_NOTEBOOK}>.\"}" \
  "${SLACK_URL}"
