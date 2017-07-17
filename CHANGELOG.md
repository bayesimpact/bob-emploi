2017-07-13_01

- Collapse 1-star advice cards in "À regarder"
- Suggest a new advice directly rom the app
- Landing page fixes
- Fix small bugs (crash, volunteering advice score)
Deployed on Thu, 13 Jul 2017 14:47:57 +0000

2017-07-11_00

- Landing Page update to highlight the value proposition, that we are an NGO and that it's collaborative.
- Strong separators in Dashboard sections.
- Ask for written feedback even when scoring advice 3 stars or more.
- Small typos and improvements in Network and Commute advice cards.
Deployed on Tue, 11 Jul 2017 07:34:10 +0000

2017-07-07_01

- Fix 2 bugs that blocked the full UI.
- Fix Firefox Landing Page bug
- Full page sign up form.
- Small UI & logging improvements.
- Network advice revamped
Deployed on Fri, 07 Jul 2017 15:43:02 +0000

2017-07-04_01

Introduce box to represent offers per inhabitant in commute advice.

Fix a missing blank in job board card.

Remove empty custom frustrations.

Allow custom frustrations.

Factorize email in base to reuse it in other advice.

Factorize a string joiner, components to chain multiple strings with separators that makes a proper sentence.

Use the new redirect endpoint in the work/life balance advice page.

Add a new endpoint that redirects to the e-Territoire proper city page.

Deployed on Wed, 05 Jul 2017 08:41:08 +0000

2017-07-04_00

- Add a page with Paul's introduction video and a signup button.
- Switch close and feedback buttons.
- Switch to ROME v332 but make sure to mark the new job group as unverified data.

Deployed on Tue, 04 Jul 2017 09:54:55 +0000

2017-06-30_00

- Improve Resume revamp.
- Improve Interview revamp.

Deployed on Fri, 30 Jun 2017 13:26:11 +0000

2017-06-28_00

- Adjust title size when there's a cookie bar so that it fits the viewport bottom exactly, and smoothly scroll down.
- Fix scrolling directly to an advice.
- Deprecate cache automatically after an hour.
- Log starring/unstarring advice cards.
- Update UI to use domains instead of sectors if there are multiple domains.

Deployed on Wed, 28 Jun 2017 14:11:06 +0000

2017-06-27_00

- Shiny landing page with photos.
- Make the score more variable.
- Logging improvements
- Work on domains and commute (behind the scene).
- UI changes in the dashboard (header, spontaneous application).
- Stabilize client/server edition of user.
Deployed on Tue, 27 Jun 2017 14:42:14 +0000

2017-06-23_00

- Ask where user knew about Bob in onboarding
- Notification in Nav bar for PE counselors
- Improve header in Dashboard
- Allow links that directly open the registration modal with a given email address to be used in subscription emails.
Deployed on Fri, 23 Jun 2017 10:45:46 +0000

2017-06-21_00

- Info Coll Kit notification
- Update landing page's title and button captio

Deployed on Wed, 21 Jun 2017 09:51:50 +0000

2017-06-20_00

- Enable starring each Advice card.
- Changelog modals for Pole Emploi counselors.
- Slight improvement to the Bob header and nav bar.
- Log hostname of current Bob version to Amplitude.
- Small fixes
- Work on Commute under the hood.
- Send an activation email when Bob advises on a new project.
Deployed on Tue, 20 Jun 2017 13:45:30 +0000

2017-06-16_00

- Feedback Bar
- Simplify the nav bar
- Small UI fixes
- Progress (hidden for now) on the commute advice.
Deployed on Fri, 16 Jun 2017 13:48:59 +0000

2017-06-14_00

- Volunteer Advice (for alpha users only)
- UI cleanups on mobile

Deployed on Wed, 14 Jun 2017 13:21:27 +0000

2017-06-12_00

Launch Project Modification. (#4844)

- Allow Editing of The Project
- Volonteer Advice Module
- Add a title and a logo for sharing on social media.
- Notebook 'Tous Benevoles'
- Various fixes and cleanups

Deployed on Mon, 12 Jun 2017 13:22:58 +0000

2017-06-09_00

- Project modification (for alpha users only)
- Card content cleaned for all advice modules
- Progress on commute advice (scoring model and UI)
- Scroll to advice by ID (using \#spontaneous-application for instance)
- UI fixes

Deployed on Fri, 09 Jun 2017 12:39:45 +0000

2017-06-02_00

- Do not send the NPS survey to users that did not complete the onboarding.
- Small changes in some cards UI.
- Redirect to dashboard when clicking on the logo.

Deployed on Fri, 02 Jun 2017 11:53:51 +0000

2017-05-31_00

- Work/Life balance content
- Harmonize some UI between advice modules.
- Add the for-experienced(2,6,10) filters.
- Fix few typos

Deployed on Wed, 31 May 2017 09:42:02 +0000

2017-05-30_00

Add API endpoint to save NPS Survey Response

Some revamps in the Dashboard Cards.

Small fixes:
- Add a fast forward to close the Bob Score modal.
- Reset scroll in modal once it's closed.
Deployed on Tue, 30 May 2017 12:09:54 +0000

2017-05-29_01

- New landing page highlighting the Diagnostic
- Remove all graphs from Advice Cards.
- Multiple small UI fixes.
Deployed on Mon, 29 May 2017 12:27:08 +0000

2017-05-24_00

New Advice Modules:
- Wow Hairdresss
- Association Help

Smaller changes:
- Drop all blue boxes.
- Update video on counselor page.
Deployed on Wed, 24 May 2017 10:51:06 +0000

2017-05-23_00

- Keep Landing Page variant used from CREST links.
- Hide the Bob Score in a modal.

Small fixes:
- Fix salary input component: on Firefox the cursor was not showing.
- Add the source of LBB companies.
- Update call to actions on advice cards.
- Only wait 5s to mark the last advice card as read.

Deployed on Tue, 23 May 2017 09:33:43 +0000

2017-05-19_00

- Update Advice Card UI to follow new value proposition.
- Add the "wow baker" advice.
- Give more context for each feedback in Slack.
- Improve logging for "End of Bob" modal.
- Scroll to next unread advice card when clicking on the progress bar.
Deployed on Fri, 19 May 2017 09:57:56 +0000

2017-05-18_01

- "Pro Page" linked from landing page for counselors.
- Progress of reading advice cards is tracked in a new bar.
- Add a Live Chat buton.
- Add in the expanded cards (they were not accessible since we dropped the Advice Page).
- "End of Bob" modal when the whole advice is read, including share buttons.
- Small UI/UX fixes

Deployed on Thu, 18 May 2017 09:15:52 +0000

2017-05-15_00

- Dashboard revamp: advice cards are expanded instead of opening a page
- Drop mail_actions (email for old actions)
- Multiple UI/UX fixes
- Add a button in debug modal to reset advices easily.
- Do not save the profile just before creating the project to avoid a race condition.
Deployed on Mon, 15 May 2017 09:16:18 +0000

2017-05-11_00

Fix converting number of stars (a float) into hiring potential (an int).

Fix minor bugs.

Deployed on Thu, 11 May 2017 07:47:20 +0000

2017-05-10_00

- Better job in group Advice.

Fixes
- number of stars from LBB for spontaneous applications.
- number of tools for events.
- better styling of Tool Card.
- Orthograph updated to 1990 reform for evenement.
- fix link for spontaneous applications to LBB.

Deployed on Wed, 10 May 2017 16:04:13 +0000

2017-05-04_00

Add a nicer box and a link to LBB.

- Event advice
- Misc fixes in the pipeline (docker, ) 
- Spontaneous application with direct integration from LBB
- Misc fixes on the website (remove card from advice page, typos, orthograph 1990) 

Deployed on Thu, 04 May 2017 14:50:42 +0000

2017-05-02_00

Launch Job Board & Motivation Advice Modules.

Other small fixes:
- Hide the whole tips section if there are no tips
- Add a scroll bar in side bar when they are too many advice modules.
- Document and regroup all the FHS fields we use.
- Fix count down on privacy notice.
- Fix display of like/dislike buttons.
Deployed on Tue, 02 May 2017 09:45:24 +0000

2017-04-26_00

- Reorder the onboarding step to finish by frustrations.
- Major upgrade of all NPM packages.
- Fix side bar in Advice Page.
- Underneath the hood (alpha users only): prepare events and job boards advice.
Deployed on Wed, 26 Apr 2017 14:48:49 +0000

2017-04-24_02

- Onboarding revamp
- Few typos
- Few logging improvements
Deployed on Mon, 24 Apr 2017 13:28:29 +0000

