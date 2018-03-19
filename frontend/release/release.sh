#!/bin/bash
# Script to run from an engineer computer to start the release process of the app.
#
# Usages:
# frontend/release/release.sh
# frontend/release/release.sh 2017-10-25_01
set -e
readonly DIRNAME=$(dirname "$0")
# Import functions echo_error, echo_warning...
source "$DIRNAME/echo_with_colors.sh"

if [ -n "$DRY_RUN" ]; then
  echo_warning 'DRY RUN: will not actually modify anything. This will not work without passing a tag.'
fi

# Helpers.
function add_previous_draft_and_commits_to_release_notes() {
  tag=$1
  release_notes=$2
  echo -e "${tag}\\n" > $release_notes
  echo -e "# Edit these release notes to make them more readable (lines starting with # are ignored, and an empty file cancels the deployment).\\n" >> $release_notes
  # Check if we can reuse notes from a previous release that was left as a draft.
  echo_info "Checking if can reuse notes from previous draft…"
  readonly last_release_tag=$(hub release | head -1)
  readonly last_release_tag_including_drafts=$(hub release --include-drafts | head -1)
  if [ "$last_release_tag_including_drafts" != "$last_release_tag" ]; then
    # Last release was left as draft.
    readonly last_release_draft_tag="$last_release_tag_including_drafts"
    echo_info "Creating new release notes for tag $tag, reusing notes from draft $last_release_draft_tag."
    # Copy notes from draft.
    echo -e '# Reusing notes from last draft release:' >> $release_notes
    hub release show $last_release_draft_tag 2> /dev/null >> $release_notes
    # Show new commits created after the release draft.
    echo -e "\\n# New commits since last draft release:" >> $release_notes
    readonly last_tag_for_git_log="$last_release_draft_tag"
  else
    echo_info "Creating new release notes for tag $tag."
    # Show new commits created since last release.
    readonly last_tag_for_git_log="origin/prod"
  fi

  readonly git_cd_up="$(git rev-parse --show-cdup)"
  git log "$last_tag_for_git_log..$tag" --format=%B -- "${git_cd_up}frontend" >> $release_notes
}


# Start.
# $1 is an optional TAG name.
if [ -z "$1" ]; then
  if [ -n "$DRY_RUN" ]; then
    echo_error 'You cannot use DRY_RUN without passing a tag (creating a tag would not be a dry run :).'
    exit 1
  fi
  # Create a new tag if none given.
  readonly TAG=$("$DIRNAME/tag.sh")
  if [ -z "$TAG" ]; then
    echo_error 'Could not create new tag.'
    exit 2
  fi
  echo_success "Created new tag $TAG"
  echo_info "Starting release for tag $TAG"
  echo "A new CircleCI workflow should have been triggered after the creation of tag $TAG."
  echo 'In a few minutes the release will be built, tested and published, and then a message will'
  echo 'be sent on Slack to ask team members to manually test this new demo.'
else
  #TODO(florian): Remove this option if we end up never using it.
  if [ "$1" == 'latest' ]; then
    readonly TAG=$(git tag | grep ^20..-..-.. | sort | tail -n 1)
  else
    # Use the given tag.
    readonly TAG="$1"
    if [ -z "$(git tag -l $TAG)" ]; then
      echo_error "The tag $TAG does not exist locally."
      exit 3
    fi
  fi
  echo_info "Starting release for tag $TAG"
  echo 'A CircleCI workflow should have already been created for this tag. Once you have edited'
  echo 'notes for the release in this script, you will need to find this CircleCI workflow and'
  echo 'to rebuild the tasks that failed.'
fi

# Prepare Release Notes.
readonly RELEASE_NOTES=$(mktemp)
if hub release show $TAG 2> /dev/null > $RELEASE_NOTES; then
  readonly RELEASE_COMMAND='edit'
  echo_info "Editing existing release notes for tag $TAG"
else
  # No notes found for this tag, we will need to create a new release.
  readonly RELEASE_COMMAND='create'
  add_previous_draft_and_commits_to_release_notes $TAG $RELEASE_NOTES
fi

read -p 'Press any key to continue or ctrl+c to cancel…'
"${EDITOR:-${GIT_EDITOR:-$(git config core.editor || echo 'vim')}}" $RELEASE_NOTES

# Remove comments from release notes.
sed -i -e "/^#/d" $RELEASE_NOTES
if [ -z "$(grep "^." $RELEASE_NOTES)" ]; then
  echo_error 'Canceling deployment due to empty release notes.'
  rm -f $RELEASE_NOTES
  exit 4
fi

echo 'Release notes are:'
echo '-------------------------------------------------------------------------------'
cat $RELEASE_NOTES
echo '-------------------------------------------------------------------------------'

echo_info "Creating a draft release on GitHub"
read -p 'Press any key to continue or ctrl+c to cancel…'
if [ -z "$DRY_RUN" ]; then
  hub release $RELEASE_COMMAND --draft --file=$RELEASE_NOTES $TAG
fi

rm -f $RELEASE_NOTES

echo_success 'Draft release is now ready on Github!'
echo_info 'Now you need to wait for 2 team members to approve the demo of the release candidate.'
echo 'Then go to CircleCI to manually approve the `wait-for-manual-approval` step of the `release` workflow'
echo 'This will finally deploy the new release on OVH and AWS.'
