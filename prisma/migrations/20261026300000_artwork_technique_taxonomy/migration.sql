-- The seven techniques of the handoff (§5): PAINTING, SCULPTURE, PHOTOGRAPHY, LITERATURE, PRINT,
-- DRAWING, MIXED_MEDIA. The categories of before move: a work on paper becomes PRINT when its
-- technique text names a printmaking process, PAINTING when it names paint ("Óleo sobre papel"),
-- DRAWING otherwise; DIGITAL and OTHER become MIXED_MEDIA.
-- Data only (category is a String with an allowlist in lib/artworks/domain.ts); reexecutable.
-- Frozen certificate payloads keep the category they were signed with (labels stay readable).
-- accents folded by translate() (lower() alone does not fold "Ó" under a C ctype); patterns ASCII only
UPDATE "Artwork" SET "category" = 'PRINT'
  WHERE "category" = 'WORK_ON_PAPER'
    AND translate(lower(coalesce("technique", '') || ' ' || coalesce("materials", '')), 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'aaaaeeioooucaaaaeeiooouc') ~ '(gravura|xilo|serigraf|litograf|agua-forte|ponta-seca|linoleo|monotip|calcograf)';
UPDATE "Artwork" SET "category" = 'PAINTING'
  WHERE "category" = 'WORK_ON_PAPER'
    AND translate(lower(coalesce("technique", '')), 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç', 'aaaaeeioooucaaaaeeiooouc') ~ '(oleo|acrilic|aquarela|guache|tempera|pintura|encaustica)';
UPDATE "Artwork" SET "category" = 'DRAWING' WHERE "category" = 'WORK_ON_PAPER';
UPDATE "Artwork" SET "category" = 'MIXED_MEDIA' WHERE "category" IN ('DIGITAL', 'OTHER');
