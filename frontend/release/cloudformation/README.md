# New Deployment

## Client Deployment

Prepare the deployment on the client-side:
- Choose an ID for your deployment `$dep`
- Create a deployment config file at `frontend/client/cfg/deployments/$dep.json5`
- Create (possibly by symlink) all the necessary files in the frontend/client/src/deployments/$dep folder
- For each needed plugin, add the relevant config file, if necessary: `frontend/client/plugins/$plugin/cfg/deployments/$dep.json5`
- Commit all your changes, requesting a [demo](#demo) with `ENV=$dep` in your commit message.

## Databases

Ask a [Mongo Atlas Admin](mailto:bob-superadmin@bayesimpact.org) to create the relevant databases for you.
- a stats DB
- a users DB
- an eval DB
Stats DB and eval DB might be shared in a single DB, since they don't share any collection names. They also might be shared between deployments, since they contain no sensitive data.
Users DB should probably be a new one, since some scheduled tasks assume that all the users in a database are from the same deployment.

Don't forget to link the Stats DB (at least) in the [demo](#demo).
You need a URL with read-write access and a URL with read-only access to each of the databases.

## <a name="demo"></a>Demo Server

To make sure your demos are run inside the new deployment, update the `fdr.env` environment file in the demo server with the following lines (all `${}` should be replaced by their real value for your deployment). If a value is actually the same as for bob-fr (for instance, we use the same users DB for all environments in demo), there's no need to add a line for it.

```env
${dep}BOB_DEPLOYMENT=$dep
${dep}MONGO_URL=${ReadOnlyProdStatsMongoUrl}
```

## <a name="public-domain-certificate-certificate"></a>Public Domain Certificate

You then need to create a certificate for the public domain you will be using. We do this with AWS Certificate Manager, through DNS validation. To be used in a cloudfront distribution, the certificate needs to be added to the us-east-1 region, so it cannot be added to the main cloudformation stack. If you're interested in a jobflix deployment, this is not the final URL, only the one under which the path `/orientation` will show Jobflix.

```sh
export AWS_DEFAULT_REGION=us-east-1
aws cloudformation create-stack \
    --stack-name bob-$dep-public-certificate \
    --template-body "$(cat frontend/release/cloudformation/public_dns_certificate.json)" \
    --parameters ParameterKey=PublicDomainName,ParameterValue=${CanonicalPublicDomain}
```

Then follow the [procedure](#dns-validation) to validate the DNS with your DNS provider. Fetch the `PublicDomainCertificate` output key, to be used in the main stack creation.

## AWS Configuration

To create an entirely new deployment you can use the `main_template.json` file using the following
command:

- Create a new deployment in `frontend/release/stack_deployments.json`
- Get the relevant parameters:
    - A domain name for the API `$ApiDomainName`. We usually use `flask.$AWS_REGION.aws.$PUBLIC_DOMAIN`, but you may choose whatever domain we have rights on
    - The mongo urls `$MongoUserRead`, `$MongoUserWrite`, `$MongoDataRead`, `$MongoDataWrite`, `$MongoEvalWrite`. (you can fetch those from existing deployment with `bob_stack_var`)
    - The newly created public domain `$PublicDomainName` and its certificate created in the previous step `$PublicDomainCertificate`

```sh
deployment="$(jq --arg dep $dep '.[]|select(.deployment == $dep)' frontend/release/stack_deployments.json)"
export AWS_DEFAULT_REGION=$(jq -r '.region' <<< $deployment)
vpc_id="$(aws ec2 describe-vpcs | jq '.Vpcs[]|select(.IsDefault)|.VpcId' -r)"
aws cloudformation create-stack \
    --stack-name $(jq -r '.stackId' <<< $deployment) \
    --template-url "$(python3 frontend/release/cloudformation/deploy.py url)" \
    --capabilities CAPABILITY_IAM \
    --parameters \
        ParameterKey=PublicDomainCertificate,ParameterValue="$PublicDomainCertificate" \
        ParameterKey=PublicDomainName,ParameterValue="$PublicDomainName" \
        ParameterKey=DomainName,ParameterValue=$ApiDomainName \
        ParameterKey=MongoDataRead,ParameterValue="$MongoDataRead" \
        ParameterKey=MongoDataWrite,ParameterValue="$MongoDataWrite" \
        ParameterKey=MongoEvalWrite,ParameterValue="$MongoEvalWrite" \
        ParameterKey=MongoUserRead,ParameterValue="$MongoUserRead" \
        ParameterKey=MongoUserWrite,ParameterValue="$MongoUserWrite" \
        ParameterKey=BobDeployment,ParameterValue=$dep \
        ParameterKey=ECSTargetVPC,ParameterValue=$vpc_id \
        ParameterKey=AvailabilitySubnets,ParameterValue=\""$(aws ec2 describe-subnets | jq --arg vpc_id "$vpc_id" '.Subnets|map(select(.VpcId==$vpc_id).SubnetId)|join(",")' -r)"\" \
        ParameterKey=DesiredServerCount,ParameterValue=1 \
        ParameterKey=EnvSecretSalt,ParameterValue=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1) \
        ParameterKey=EnvAdminAuthToken,ParameterValue=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1) \
        ParameterKey=EnvAirtableApiKey,ParameterValue="$(bob_prod_var AIRTABLE_API_KEY)" \
        ParameterKey=EnvElasticSearchUrl,ParameterValue="$(bob_prod_var ELASTIC_SEARCH_URL)" \
        ParameterKey=EnvMailjetSecret,ParameterValue="$(bob_prod_var MAILJET_SECRET)" \
        ParameterKey=EnvSentryDsn,ParameterValue="$(bob_prod_var SENTRY_DSN)" \
        ParameterKey=EnvSlackFeedbackWebhookUrl,ParameterValue="$(bob_stack_var fr EnvSlackFeedbackWebhookUrl)" \
        ParameterKey=EnvSlackImportUrl,ParameterValue="$(bob_stack_var fr EnvSlackImportUrl)" \
        ParameterKey=EnvSlackWebhookUrl,ParameterValue="$(bob_stack_var fr EnvSlackWebhookUrl)" \
        ParameterKey=FlaskDockerTag,ParameterValue="$(bob_stack_var fr FlaskDockerTag)" \
        ParameterKey=ImporterDockerTag,ParameterValue="$(bob_stack_var fr ImporterDockerTag)" \
        ParameterKey=LambdaAuxPageRedirect,ParameterValue="$(bob_stack_var fr LambdaAuxPageRedirect)" \
        ParameterKey=LambdaOpenGraphRedirect,ParameterValue="$(bob_stack_var fr LambdaOpenGraphRedirect)" \
        ParameterKey=ScheduledTasksStatus,ParameterValue=DISABLED
```

Do the [DNS Validation](#dns-validation) step below, then fetch the `LoadBalancerDnsName` output key, as explained there.

Add a new DNS record from the domain name chosen `$ApiDomainName` to the output of the command above, and then you're done.

## Prepare for later auto-deployments

TODO(cyrille): Replace specific ARN parameters with tag-based permissions.
TODO(cyrille): Use tag-based permissions for ecs:DescribeClusters.
For the CI to be able to release the new deployment on its own, it needs permissions in AWS. We use the stack `bob-permissions` in `eu-west-3` for this. Once you've created the stack above (and the jobflix one if needed), [update the stack](https://eu-west-3.console.aws.amazon.com/cloudformation/home?region=eu-west-3#/stacks/update/parameters?stackId=arn%3Aaws%3Acloudformation%3Aeu-west-3%3A951168128976%3Astack%2Fbob-permissions%2Fd92b4770-9bb9-11ec-a64b-0a25cee3c284) by adding the relevant ARNs to each parameter:

- `bob_stack_resource $dep ECSService` to the `StackServices` parameter
- `arn:aws:cloudformation:$region:951168128976:stack/$stackId/*` to the `StackNames` parameter (remember to add your Jobflix stack here too, if relevant)
- `arn:aws:cloudfront::951168128976:distribution/$(bob_stack_resource $dep CloudfrontDistribution)` to the `StackDistributions` parameter (don't forget to get the Jobflix distribution too)

## Jobflix AWS Configuration

If your deployment needs a Jobflix URL different from bobURL/orientation, you should also deploy a stack with the `jobflix.json` template.

Redo the certificate creation step for a [public domain](#public-domain-certificate) (remember to put it in `us-east-1`) with your jobflix domain `$JobflixDomainName`, and get its output as `$JobflixDomainCertificate`. Then create the stack with the following command:

```sh
deployment="$(jq --arg dep $dep '.[]|select(.deployment == $dep)' frontend/release/stack_deployments.json)"
export AWS_DEFAULT_REGION=$(jq -r '.region' <<< $deployment)
aws cloudformation create-stack \
    --stack-name "$(jq -r '.stackId' <<< $deployment)-jobflix" \
    --template-url "$(python3 frontend/release/cloudformation/deploy.py url jobflix)" \
    --capabilities CAPABILITY_IAM \
    --parameters \
        ParameterKey=BobDeployment,ParameterValue=$dep \
        ParameterKey=DomainName,ParameterValue=$ApiDomainName \
        ParameterKey=JobflixDomainCertificate,ParameterValue=$JobflixDomainCertificate \
        ParameterKey=JobflixDomainName,ParameterValue=$JobflixDomainName
```

## <a name="dns-validation"></a>ACM DNS Validation for TLS Certificates

A few minutes after having requested a stack creation `$my_stack_name` with an ACM Certificate, the following command should help you identify the DNS record to create:

```sh
aws cloudformation describe-stack-events --stack-name $my_stack_name |
    jq '.StackEvents[]|.ResourceType="AWS::CertificateManager::Certificate"|.ResourceStatusReason|select(. != null)|select(contains("DNS Record"))' -r
```

Make sure to run it in the same region as the stack creation command (if you've exported AWS_DEFAULT_REGION before creating the stack, you should be fine).

Create the corresponding DNS record, then wait for the stack to be created (few minutes), then run
the following command to find the value you need to keep going:

```sh
aws cloudformation describe-stacks --stack-name $my_stack_name | \
    jq --arg key ${OutputKey} '.Stacks[].Outputs[]|select(.OutputKey == $key)|.OutputValue' -r
```

## Redirect with a utm source

As of February of 2022, we avoid using multiple hostnames for a single deployment, because it implies technical issues in Cloudformation and product issues on how to make sure users always keep the same hostname.

To palliate this issue, we use a 302 redirect from a secondary hostname to the official hostname, with a utm_source for bookkeeping. This redirection uses the `utm_redirect.json` template. It needs an `OriginDomainName`, an `OriginDomainCertificate` associated with it (that you should create using [this section](#public-domain-certificate)), the deployment (as `$dep`) you wish to redirect to, and the `UtmSource` you want to add (make sure it's URL encoded, if needed).

```sh
aws cloudformation create-stack \
    --stack-name "redirect-utm-${dep}" \
    --region "$(jq -r --arg dep $dep '.[]|select(.deployment == $dep).region' frontend/release/stack_deployments.json)" \
    --template-body "$(jq . frontend/release/cloudformation/utm_redirect.json)" \
    --parameters \
        ParameterKey=OriginDomainName,ParameterValue="$OriginDomainName" \
        ParameterKey=OriginDomainCertificate,ParameterValue="$OriginDomainCertificate" \
        ParameterKey=TargetDomainName,ParameterValue="$(bob_stack_var $dep PublicDomainName)" \
        ParameterKey=UtmSource,ParameterValue="$UtmSource"
```
