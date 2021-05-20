# New Deployment

To create an entirely new deployment you can use the `main_template.json` file using the following
command:

[//]: # (TODO(pascal): Move secrets somewhere else.)

```sh
export AWS_REGION=eu-west-2
aws cloudformation create-stack \
    --stack-name bob-us \
    --region $AWS_REGION \
    --template-body "$(cat frontend/release/cloudformation/main_template.json)" \
    --parameters \
        ParameterKey=DomainName,ParameterValue=flask.$AWS_REGION.aws.us.hellobob.com \
        ParameterKey=ECSTargetVPC,ParameterValue="$(aws ec2 describe-vpcs --region $AWS_REGION | jq '.Vpcs[]|select(.IsDefault)|.VpcId' -r)" \
        ParameterKey=AvailabilitySubnets,ParameterValue=\""$(aws ec2 describe-subnets --region $AWS_REGION | jq .Subnets[].SubnetId -r | tr '\n' ',' | sed -e "s/.$//")"\" \
        ParameterKey=EnvEmploiStoreClientSecret,ParameterValue="$(bob_prod_var EMPLOI_STORE_CLIENT_SECRET)" \
        ParameterKey=EnvUsersMongoUrl,ParameterValue="$(bob_prod_var USERS_MONGO_URL)" \
        ParameterKey=EnvLinkedInClientSecret,ParameterValue="$(bob_prod_var LINKED_IN_CLIENT_SECRET)" \
        ParameterKey=EnvMongoUrl,ParameterValue="$(bob_prod_var MONGO_URL)" \
        ParameterKey=EnvElasticSearchUrl,ParameterValue="$(bob_prod_var ELASTIC_SEARCH_URL)" \
        ParameterKey=EnvSecretSalt,ParameterValue="$(bob_prod_var SECRET_SALT)" \
        ParameterKey=EnvAdminAuthToken,ParameterValue=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1) \
        ParameterKey=EnvFacebookAppSecret,ParameterValue="$(bob_prod_var FACEBOOK_APP_SECRET)" \
        ParameterKey=EnvMailjetSecret,ParameterValue="$(bob_prod_var MAILJET_SECRET)" \
        ParameterKey=EnvSentryDsn,ParameterValue="$(bob_prod_var SENTRY_DSN)
```

Then after a few minutes the following command should help you identify the DNS record to create to
validate the TLS certificate:

```sh
aws cloudformation describe-stack-events \
    --stack-name bob-uk --region eu-west-2 | \
jq '.StackEvents[]|.ResourceType="AWS::CertificateManager::Certificate"|.ResourceStatusReason|select(. != null)|select(contains("DNS Record"))' -r
```

Create the corresponding DNS record, then wait for the stack to be created (few minutes), then run
the following command to find the DNS of the created service:

```sh
 aws cloudformation describe-stacks \
    --stack-name bob-uk --region eu-west-2 | \
jq '.Stacks[].Outputs[]|select(.OutputKey == "LoadBalancerDnsName")|.OutputValue' -r
```

Add a new DNS record from the domain name chosen (here it was `flask.eu-west-2.aws.uk.hellobob.com`)
to the output of the command above, and then you're done.

The next step is to create the [Cloudfront distribution](../cloudfront/README.md).
