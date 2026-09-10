# Content intake

Content is frozen. Everything is resolved except two binary assets Peter supplies directly rather than through a content file:

- **Resume PDF** — `public/Peter_Wang_Resume.pdf`, linked from `/resume`. Delivered.
- **Photo** for `/about` — `public/Peter_Picture.JPG`, rendered on the page. Delivered.

Both are in place as of this writing. If either is replaced with a newer version, drop it in `public/` **under the same filename** and no code changes are needed.

**The filename is load-bearing, and getting it wrong fails quietly.** `/Peter_Wang_Resume.pdf` is a published URL that may already be on job applications, and `/resume` links it directly. A replacement dropped in under a different name — exports tend to come out as `Peter_Public_Resume.pdf` — leaves the live link dead while the new file sits there unreferenced. Worse, `git add public/Peter_Wang_Resume.pdf` on a path that no longer exists stages a **deletion**, so a commit meant to update the resume removes it instead. That has happened once; it was caught in the diffstat (`Bin 126262 -> 0 bytes`) and not by anything else. Rename to the existing filename first, then commit, then check the diffstat says `Bin x -> y` rather than `-> 0`.
