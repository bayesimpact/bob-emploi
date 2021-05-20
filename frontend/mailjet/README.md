# Mailjet CLI

Mailjet service is pretty convenient to send emails, however its WYSIWYG editor for templates,
called Passport, isn't enough for what we want. We have decided to keep our template definitions
in Git and use the tool in this package to update the template collections in Mailjet.

The format we use for each template is a folder with the following file:
 * `headers.json`, a JSON file with the template's headers.
 * `template.mjml`, a MJML file (or its JSON version) with the template's definition.
 * `template.txt`, a plain text file with the text version of the template (usually empty).
 * `vars.txt`, a plain text file with variables used in the templates, one var per line.
 * `vars-example.json`, a JSON file with an example of values for each variable.
 * `template.html`, an HTML file using mustache with the template's definition.

TODO(pascal): Replace all vars.txt files by vars-example.json files.
TODO(pascal): Get rid of html templates.

Those files are versioned and should be kept easy to read, and easy to diff.
