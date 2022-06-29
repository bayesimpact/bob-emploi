# Mailjet CLI

Mailjet service is pretty convenient to send emails, however its WYSIWYG editor for templates,
called Passport, isn't enough for what we want. We have decided to keep our template definitions
in Git and use the tool in this package to update the template collections in Mailjet.

The format we use for each template is a folder with the following file:
 * `headers.json`, a JSON file with the template's headers.
 * `template.mjml`, a MJML file with the template's definition.
 * `vars-example.json`, a JSON file with a value example for each variable used in the template.
 * `template.html`, an HTML file, generated from `template.mjml`.

Those files are versioned and should be kept easy to read, and easy to diff.
