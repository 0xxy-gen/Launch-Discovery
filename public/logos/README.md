# Provider logos

Drop an image here named after the provider and `npm run seed:logos` will
attach it to that company. It then appears on every listing in place of the
monogram, exactly as it would if the provider had uploaded it themselves on
their profile page.

Naming: lower-case the company name and replace spaces with hyphens.

    SpaceX                       -> spacex.png
    Rocket Lab                   -> rocket-lab.png
    Rocket Factory Augsburg      -> rocket-factory-augsburg.png
    Mitsubishi Heavy Industries  -> mitsubishi-heavy-industries.png
    ISRO                         -> isro.png

`.png`, `.jpg`, `.jpeg`, `.webp` and `.svg` all work. Square images look best;
anything else is letterboxed rather than cropped, so a wordmark stays readable.
Keep files under ~200 KB — they are stored inline on the company record.

Note that these are other companies' trademarks. Using them implies a
relationship with the provider, so get permission before showing this to
anyone outside your own team. Nothing is committed from this folder.
