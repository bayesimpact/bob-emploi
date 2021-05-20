# A-Li

This product is a command from national Mission Locale (UNML) to help onboard new people, with or without the help of a counselor.

It is available at /mini.

## Analytics for A-Li

Analytics for A-Li happens in Amplitude where we log important events in the /mini app.

### Sessions and User ID

Most usage of A-Li happens in one session and without refreshing the page, therefore Amplitude
events are sent without setting any specific ID. This means that all A-Li events from the same
computer and browser will be in the same Amplitude session allowing us to follow and understand
the usage on that computer.

There is a workflow where a user starts a session, saves it by e-mail, then continues it
from another computer or browser. When that happens we set an Amplitude User ID in the save event
and reload the same ID when opening the corresponding link.

Saving several times for the same user keeps the same ID, however restarting the A-Li flow resets
that user ID (either by using the Restart button or by refreshing the page). When this happens we
also reset the Amplitude ID so that the events sent after resetting or refreshing go to a new
Amplitude user.
