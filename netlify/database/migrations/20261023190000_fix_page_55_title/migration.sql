-- Page 55 was posted with the title "Page 25" by mistake. Only that typo is
-- replaced, so a title changed in the Studio since stays as it is.
UPDATE "comic_pages" SET "title" = 'Page 55'
WHERE "page_number" = 55 AND "title" = 'Page 25';
