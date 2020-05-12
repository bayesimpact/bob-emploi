# TODO(sil) Add the possibility to give a tag name
# and create a new version of a previous tag.

set -e
readonly DIRNAME=$(dirname "$0")
# Import functions echo_error, echo_warning...
source "$DIRNAME/echo_with_colors.sh"

# Start.
# Create a new tag.
readonly RELEASE_TYPE="DATA"
# It's dangerous to publish a data-importer more recent that frontend (which is on the prod branch)
# since there might be discrepancies in the protos, or the import validation code.
readonly TAG=$("$DIRNAME/tag.sh" ${RELEASE_TYPE} prod)
if [ -z "$TAG" ]; then
  echo_error 'Could not create new tag.'
  exit 2
fi
echo_success "Created new tag $TAG"
echo "A new CircleCI workflow should have been triggered after the creation of tag $TAG."
echo 'In a few minutes the release will be built, tested, published and deployed.'
