-- Swap the template's example characters for the Anno Arcana cast. Only the
-- untouched examples are removed, so anything edited in the Studio stays.
DELETE FROM "characters"
WHERE "image_key" IS NULL
  AND "image" IN (
    '/img/characters/vasilisa.jpg',
    '/img/characters/jakub.jpg',
    '/img/characters/mateusz.jpg',
    '/img/characters/aleks.jpg',
    '/img/characters/motanka.jpg'
  );
--> statement-breakpoint
-- Descriptions are placeholders to be written in the Studio (/admin/)
INSERT INTO "characters" ("name", "description", "image", "position") VALUES
	('Javi', 'More about Javi coming soon!', '/img/characters/javi.jpg', 1),
	('Bedelia', 'More about Bedelia coming soon!', '/img/characters/bedelia.png', 2),
	('Evan', 'More about Evan coming soon!', '/img/characters/evan.png', 3),
	('Sigil', 'More about Sigil coming soon!', '/img/characters/sigil.png', 4);
