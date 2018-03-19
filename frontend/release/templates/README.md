# MailJet Templates

This folder contains templates we use in MailJet, so that they are in our versionning system.
They are imported from MailJet server, using their api https://dev.mailjet.com/email-api/v3/template-detailcontent/.

To re-import the templates from mailjet: `frontend/release/mailjet_templates.sh download`

For each template, we keep in a separate subfolder:
- a headers.json file
- a template.html file
- a template.txt file
- a template.mjml (JSON format) file

Modifications should be done on all three template.XXX files. Later improvement might reduce this overhead.

To send the templates back to MailJet (after modification): `frontend/release/mailjet_templates.sh upload`
