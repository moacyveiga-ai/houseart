-- The seven techniques of the handoff (§5): PAINTING, SCULPTURE, PHOTOGRAPHY, LITERATURE, PRINT,
-- DRAWING, MIXED_MEDIA. The categories of before move: a work on paper becomes PRINT when its
-- technique text names a printmaking process, PAINTING when it names paint ("Óleo sobre papel"),
-- DRAWING otherwise; DIGITAL and OTHER become MIXED_MEDIA.
-- Data only (category is a String with an allowlist in lib/artworks/domain.ts); reexecutable.
-- Frozen certificate payloads keep the category they were signed with (labels stay readable).
UPDATE "Artwork" SET "category" = 'PRINT'
  WHERE "category" = 'WORK_ON_PAPER'
    AND lower(coalesce("technique", '') || ' ' || coalesce("materials", '')) ~ '(gravura|xilo|serigraf|litograf|água-forte|agua-forte|ponta-seca|linoleo|linóleo|monotip|calcograf)';
UPDATE "Artwork" SET "category" = 'PAINTING'
  WHERE "category" = 'WORK_ON_PAPER'
    AND lower(coalesce("technique", '')) ~ '(óleo|oleo|acrílic|acrilic|aquarela|guache|têmpera|tempera|pintura|encáustica|encaustica)';
UPDATE "Artwork" SET "category" = 'DRAWING' WHERE "category" = 'WORK_ON_PAPER';
UPDATE "Artwork" SET "category" = 'MIXED_MEDIA' WHERE "category" IN ('DIGITAL', 'OTHER');
