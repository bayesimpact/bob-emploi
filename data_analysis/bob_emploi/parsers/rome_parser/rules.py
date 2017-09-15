""" rules.py

Contains the regexes used by the rule engine.
there are three types of rules:

Type rules:
    These are rules that will set binary flags depending on whether a pattern
    is recognized that seems to fit one of the type of requirements we set.
    These are usually simple word patterns that are specific to this type
    of requirements and that we test the presence of.

Importance rules:
    These are rules that will set binary flags depending on whether a pattern
    is recognized that seems to indicate the importance of the requirement.
    These are usually simple word patterns that we test the presence of.

As of now most of the types and importances are parsed with no issue (> 75%);
adding more patterns could help improve coverage. There aren't too many
collisions, many of which are legitimate (ambiguous or not well separated
requirements).

Content rules:
    These are rules that try to extract the "Level" and "Subject" variables,
    which are more complex (we have to extract the right content, as opposed
    to just getting binary flags).

    These use capturing groups within common patterns. The most common one is
    "X in Y", which match patterns like:
    "[5 years] in [the retail industry]" or
    "[Bachelor's] in [chemistry]"

As of now the main source of improvement will come from adding more rules
for content parsing. The sentence structures are somewhat standardized, with
about 10 structures being very common and representing almost all sentences,
then a long-tail of some more unique patterns.

Notes for the regexes:
    - You need to use the r flag (raw string) to use chars like '\b' without
     needing to escape them
    - I added the u flag (unicode string) on a few that try to match for
    unicode chars (due to pesky french accented letters), but then gave
    up since unicode handling in Python is annoying and decided to just
    replace them in the pattern with a '.?.?' pattern to match two
    indiscriminate letters (two in order to handle potential mojibake).
    (Yeah, I'm just lazy.) I still left the 'u' flag in there though.
"""


# = Degree rules = #

# This is a list of degrees; I give them a different treatment because of the
# number of degrees that exist and the fact they're very short (meaning I need
# to actually bother delineating the words in the regexes).

DEGREES = r'bac,baccalaur.?.?at,cap,bep,bts,dut,licence,l[1-3],master,'
DEGREES += r'm[1-2]mast.?.?re,dipl.?.?me,des formations,bac professionnel'


# This is the main dictionary containing the rules for each type flag.
# The key is the name of the rule (also the name of the flag that will be set)
# and the value is the regex.

TYPE_RULES = {
    'degree': r'(\b' + r'\b|\b'.join(DEGREES.split(',')) + r'\b)' +
              '( specialis.?.?s?)?',
    'certification': "((la|une) formation|l'inscription|attestation|" +
                     'habilitations?|' +
                     'Les permis|' +
                     '(des|le) permis|certifications?|carte|' +
                     r'(certificats?)\b)' +
                     r'( professionnel(le)?s?)?',
    'experience': r"((d'|une )exp.?.?riences?|" +
                  r"d'exercice|(?<!r )d'activit.?.?)" +
                  r'( professionnel(le)?s?)?',
    'skill': r'(une|des) connaissances?|' +
             r'la ma.?.?trise|la pratique|comp.?.?tences',
    'other': r'des vaccinations|casier judiciaire|' +
             r'des d.?.?marches|des agr.?.?ments',
}

# This is the main dictionary containing the rules for each importance level.
IMPORTANCE_RULES = {
    'required': r'est accessible|(est|sont) (souvent )?(exig|requis|demand)',
    'alternative': r'.?.?galement accessible',
    'sometimes': r'(parfois|peut .?.?tre|peuvent .?.?tre) (exig|requis|demand)',
    'bonus': r'peu(ven)?t en faciliter|est appreci',
}

# Content rules start here.
'''This next block creates what I call the base rule, which is a simple but
effective generic rule that matches a lot of patterns. It recognizes the
X in Y pattern when they're surrounded by a type and an importance level.
Example: "A [Bachelor's] in [accounting] [is required].

The idea here is that the patterns used in the type and importance rules
are actually pretty good at detecting the start and end of this pattern.
So I just did a massive OR between all the type patterns to get a
"This sentence piece defines a type of requirement" pattern; same with
importances. Furthermore, the type detection patterns tend to be reasonable
basesfor the levels as well.'''

# First we make all groups non-capturing in the patterns we want to OR together
# (treat lookaheads and lookbehinds separately when doing this though)
ALL_TYPE_RULES = r'(?:{0})'.format(
    r'|'.join(TYPE_RULES.values()).replace('(', '(?:'))
ALL_TYPE_RULES = ALL_TYPE_RULES.replace('(?:?<!', '(?<!')
ALL_IMPORTANCE_RULES = r'(?:{0})'.format(
    r'|'.join(IMPORTANCE_RULES.values()).replace('(', '(?:'))
ALL_IMPORTANCE_RULES = ALL_IMPORTANCE_RULES.replace('(?:?<!', '(?<!')

BASE_RULE = r"((?:{0})) (?:en|dans|de|de l'|l'|d')? ?(.+) (?:{1})"

# This is the main dictionary containing the different content rules.
CONTENT_RULES = {
    'base_rule': BASE_RULE.format(ALL_TYPE_RULES, ALL_IMPORTANCE_RULES),
    'degree1': r"est accessible (?:\.?.? partir|avec) (?:du|d'un|le|un)" +
               r'(?: dipl.?.?me de niveau)? (.+) ' +
               r'(?:en|dans|de|pour) (?:le |un |la )?(.+)(?: en | dans )?\.$',
}
