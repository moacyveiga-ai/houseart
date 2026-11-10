// "Ver em parede": the work, a 2,20 m sofa and the 1,70 m person-height ruler drawn in ONE real scale (pixels per
// millimetre). The old scene took the work height from the stage HEIGHT and the sofa width from the stage WIDTH, so
// the proportion between them changed with the window and the work looked out of scale with the furniture.
// Pure: the component measures the stage and draws what this returns (px, measured from the stage's bottom-left).

export const SOFA = { widthMm: 2200, heightMm: 850, seatMm: 450, legMm: 100, armWidthMm: 180, armHeightMm: 650 } as const
export const REF_MM = 1700
/** Gap between the sofa back and the bottom of the frame, and the eye line the centre of a small work sits on. */
export const HANG_GAP_MM = 250
export const EYE_LINE_MM = 1550

export interface Box { left: number; bottom: number; width: number; height: number }
export interface WallLayout {
  /** pixels per millimetre */
  k: number
  floor: number
  work: Box
  sofa: { body: Box; back: Box; armL: Box; armR: Box; legL: Box; legR: Box }
  ruler: { left: number; bottom: number; height: number }
}

/** `floorMin`: px the floor band must cover (the Obra · Ver em parede control sits on it at phone width). */
export interface StageSize { width: number; height: number; topReserve?: number; floorMin?: number }

export function wallLayout(stage: StageSize, work: { widthMm: number; heightMm: number }): WallLayout | null {
  const { width: w, height: h } = stage
  if (!(w > 0 && h > 0 && work.widthMm > 0 && work.heightMm > 0)) return null
  const floor = Math.max(Math.round(h * 0.14), stage.floorMin ?? 0)
  const top = stage.topReserve ?? 56
  const avail = Math.max(1, h - floor - top)
  // the frame sits 25 cm over the sofa back; a small work is centred on the 1,55 m eye line
  const hangBottomMm = Math.max(SOFA.heightMm + HANG_GAP_MM, EYE_LINE_MM - work.heightMm / 2)
  const k = Math.min(
    (h * 0.42) / REF_MM, // the usual room: 1,70 m is 42 % of the stage
    avail / (hangBottomMm + work.heightMm), // a big work still fits under the top
    avail / REF_MM,
    (w * 0.8) / Math.max(work.widthMm, SOFA.widthMm), // and across
  )
  const px = (mm: number) => mm * k
  const cx = w / 2
  const workW = px(work.widthMm), workH = px(work.heightMm)
  const sofaW = px(SOFA.widthMm), sofaL = cx - sofaW / 2
  const leg = px(SOFA.legMm), armW = px(SOFA.armWidthMm)
  const sofa = {
    body: { left: sofaL, bottom: floor + leg, width: sofaW, height: px(SOFA.seatMm - SOFA.legMm) },
    back: { left: sofaL + armW, bottom: floor + px(SOFA.seatMm), width: sofaW - 2 * armW, height: px(SOFA.heightMm - SOFA.seatMm) },
    armL: { left: sofaL, bottom: floor + leg, width: armW, height: px(SOFA.armHeightMm - SOFA.legMm) },
    armR: { left: sofaL + sofaW - armW, bottom: floor + leg, width: armW, height: px(SOFA.armHeightMm - SOFA.legMm) },
    legL: { left: sofaL + armW * 0.5, bottom: floor, width: Math.max(2, px(60)), height: leg },
    legR: { left: sofaL + sofaW - armW * 0.5 - Math.max(2, px(60)), bottom: floor, width: Math.max(2, px(60)), height: leg },
  }
  return {
    k,
    floor,
    work: { left: cx - workW / 2, bottom: floor + px(hangBottomMm), width: workW, height: workH },
    sofa,
    ruler: { left: Math.max(24, w * 0.06), bottom: floor, height: px(REF_MM) },
  }
}
