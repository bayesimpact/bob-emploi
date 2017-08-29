This page documents how we release Bob Emploi to prod.

It happens in 3 main steps: Tag, Assess the quality and Deploy.

## Tag

The first step for the release is to decide which code to release, for that we create a new tag. There is a convenient script that does that for you when you want to release the latest code available:

```sh
frontend/release/tag.sh
```

## Assess the Quality

When the tagging is done, if the tests or the packaging fail you will receive
an email, if it succeeds it posts on the channel
[#bob-emploi-bots](https://bayesimpact.slack.com/messages/bob-emploi-bots/) a
link to a demo: go there and check that everything is alright.

Check at least:
* Access the landing page (signed-off).
* Scroll down.
* Scroll back up.
* Click on "Sign-up" link.
* Enter a fake account (@example.com) and create a new user.
* Fast forward through the whole onboarding.
* Open an advice card.

## Release

When ready, you can then deploy the new version to production. This is done by using the script:

```sh
frontend/release/deploy.sh <TAG>
```

Note that you can use the special value `latest` for the tag name: it will
deploy the latest tag created.

Also note that only users with admin access both on AWS and OVH can deploy a
release.

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

* notify everybody with an @channel in bob-emploi on slack.
* write a detailed description of the problem.
* make clear your availabilities / best channel to reach you.

