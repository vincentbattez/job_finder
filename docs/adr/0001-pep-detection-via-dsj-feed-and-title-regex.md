# Detect court attaché Postings through the national DSJ feed and a regex on the title

<!-- The site's own labels, in French: cspell:ignore Judiciaires Juriste spécialisé juridiction Nord -->

Place de l'Emploi Public has no feed dedicated to court attachés (attachés de justice). We read the RSS feed of the Direction des Services Judiciaires entity (`offerRss.ashx?LCID=1036&Rss_Entity=1123&top=1000`). This feed holds every court attaché Posting, which we recognize by a regex on the title and an exclusion list. The Zone is expressed in court-of-appeal jurisdictions: Hauts-de-France matches exactly the jurisdictions of Douai (entity 1779) and Amiens (entity 1798). We read it from the employing court of appeal of the Posting, never from the department it displays.

## Considered Options

Measured on 2026-10-29, on 82 court attaché Postings online:

- **The site's keyword search feed.** It misses 5 Postings out of 82 (titles with "(e)") and returns 11 false positives (chef de cabinet, assistant spécialisé…). A parenthesis in the keyword causes an HTTP 500.
- **The Domain/Trade filter "Juriste spécialisé en juridiction".** It misses 22 Postings out of 82, which their recruiter filed under other trades.
- **Zone by department.** The displayed department is sometimes wrong: Postings of the TJ of Boulogne-sur-Mer are filed under "Nord (59)".

## Consequences

- Without `top`, the feed stops at the 20 most recent Postings. The parameter is therefore mandatory.
- The site silently ignores an unknown filter id and then returns every Posting. The Detection checks that the title of the RSS channel matches the requested filter, and fails otherwise.
- Postings stay in the feed after their Deadline, and their `pubDate` can change. We deduplicate on the reference (`YYYY-NNNNNNN`), never on the date.
- A Posting leaves the feed only once the site takes it offline, and its detail page then redirects to the home page (12 out of 12 on 2026-10-31). A stored Posting the feed no longer lists is therefore Unpublished, without reading its page.
- The feed holds neither the Deadline, nor contacts, nor place of work: these come from the detail page, saved at Detection time.
