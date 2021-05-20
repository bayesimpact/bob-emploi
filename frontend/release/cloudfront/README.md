# Cloudfront Configuration

This folder holds our configuration that is deployed automatically through CI. See
the [design doc](http://go/bob:cloudfront-as-code).

## Create a new distribution

To create a new distribution for Bob, you should first create a new certificate in AWS for the
new host names. And then copy one of the config files and change:
 * `Aliases`, use the new host names you're after. Please, put the main one as first.
 * `CallerReference`, set it to a random string
 * `Origins.Items[S3-bob-emploi-client].OriginPath`, set it to the path for the given deployment
 * `Origins.Items[PE Static Assets on OVH].OriginPath`, same as above
 * `Origins.Items[ELB-flask-lb-1252672423].DomainName`, set it to the URL of the server (or the load
   balancer), if you haven't created one yet, see the doc [here](../README.md)
 * `ViewerCertificate.ACMCertificateArn` and `ViewerCertificate.Certificate`, set them to the URN of
   the certificate that you've created above.

Once you're done, run the following command:

`aws cloudfront create-distribution --distribution-config="$(cat frontend/release/cloudfront/<your file here>.json)"`

From the output find the `Distribution.Id` and add it to the `index.json` file.

From the output also find the `Distribution.DomainName` value and create a `CNAME` DNS entry from
your initial host names to this value.
