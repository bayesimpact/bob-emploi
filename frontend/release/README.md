This page documents how we release Bob to prod.

It happens in 3 main steps: 'Release', 'Check release notes and ask for manual approval', and 'Deploy'.

## Release

The first step for the release is to decide which code to release.

To create a new tag with the current master and start a release with it:
```sh
frontend/release/release.sh
```

To start a release with an existing tag:
```sh
frontend/release/release.sh 2017-10-23_00
```

To start a release with the latest tag created:
```sh
frontend/release/release.sh latest
```

The script will ask to write the release notes, which will be necessary to unblock the next steps.
If a new tag is created, this will trigger a new `release` CircleCI workflow. This workflow will first build, test and deploy the code to Docker Hub. The workflow will then check the release notes and ask for manual approval.

If the release was started with a previous tag, go to CircleCI and rerun the steps of the workflow that was previously created for this tag.

## Check release notes and ask for manual approval

If the build or tests fail you will receive an email.

Otherwise the CircleCI workflow will run the step `check-release-notes-and-ask-for-manual-approval` which will make sure the release notes that should have been created in the 'Release' steps are ready. If they are not ready yet, the step will fail but can be built again to try again.

Once the release notes are ready, team members are pingued on Slack on [#bob-emploi-bots](https://bayesimpact.slack.com/messages/bob-emploi-bots/) to test the new demo of this release candidate. Go there and check that everything is alright.

Check at least:
* Access the landing page (signed-off).
* Scroll down.
* Scroll back up.
* Click on "Sign-up" link.
* Enter a fake account (@example.com) and create a new user.
* Fast forward through the whole onboarding.
* Open an advice card.

## Deploy

After getting approval from at least 2 team members, go to the [release workflow](https://circleci.com/gh/bayesimpact/workflows/bob-emploi-internal) and manually validate the pending workflow step. This will resume the workflow and deploy the code to OVH and AWS. Anyone with CircleCI credentials can do it, but the engineer who started the release should do it.

## Check Prod

Wait for the release to hit the AWS CloudFront cache (~10 or 15 minutes), then
check that everything is alright in prod (see the list above).

## Rollback

If anything goes wrong or if something is broken in prod, you can revert to a
previous version by deploying an old tag:

* Check the [list of releases](http://go/bob:releases) and find the
  version to which you want to rollback.
* Run the release process as above:
```sh
frontend/release/deploy.sh <ROLLBACK_TAG>
```

## Emergency

If you can not solve an emergency by yourself:

* notify everybody with an @channel in bob on slack.
* write a detailed description of the problem.
* make clear your availabilities / best channel to reach you.

## New Deployment

See [CloudFormation](cloudformation/README.md)
