# Determine whether the big test suite with execution of the Makefile and the slow tests should be run.
# Slow tests will be executed if the branch name contains `export`.

readonly GIT_BRANCH=`git rev-parse --abbrev-ref HEAD`
if [[ ! $GIT_BRANCH =~ "export" ]] ; then
  touch skip-slow-tests
fi

