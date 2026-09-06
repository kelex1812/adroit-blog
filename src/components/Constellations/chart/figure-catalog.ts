/**
 * figure-catalog.ts — the constellations a course can be drawn as.
 *
 * Course-agnostic on purpose. `3d/asterism-data.ts` keys figures by
 * `seriesSlug`, which hardcodes "this course is Orion" and cannot answer "which
 * figure fits a 10-lesson course". These are just constellations; `assignFigures`
 * matches them to courses by size.
 *
 * ## Why size matters
 *
 * A course's constellation should have about as many stars as the course has
 * lessons, so a lesson can light a star. That number has to be the curriculum's
 * *final* lesson count (`ConstellationState.curriculumLessons`), not the count
 * published so far — lessons land daily, and a figure that reshuffled every time
 * one shipped would be worthless as a progress surface.
 *
 * ## Accuracy
 *
 * RA/Dec are J2000 catalogue positions and magnitudes are apparent V, to about
 * a hundredth of an hour and a tenth of a degree. The chart projects these and
 * then normalises the result into a bounding box, so what survives to the screen
 * is the figure's *shape*; small absolute errors are invisible. `connections`
 * traces the traditional recognizable figure, not lesson order.
 *
 * Every figure here draws all of its members — `chart.test.ts` enforces that, so
 * a member can never become an orphan dot floating outside the outline.
 */
import type { SpectralClass } from "../3d/star-model";

export interface CatalogStar {
  /** Bayer designation / proper name, e.g. "Vega (α Lyr)". */
  name: string;
  /** Right ascension, hours (J2000). */
  raH: number;
  /** Declination, degrees (J2000). */
  decDeg: number;
  spectralClass: SpectralClass;
  /** Apparent magnitude (lower = brighter). */
  magnitude: number;
  /** Astronomically-red members keep their true tint (ADR-303). */
  isRedGiantAccent?: boolean;
  /** A nebula anchor rather than a star. */
  isNebula?: boolean;
}

export interface ConstellationFigure {
  /** Constellation name. Also resolves the engraved plate — see `plateSlug`. */
  name: string;
  stars: CatalogStar[];
  /** Pairs of indices into `stars`, tracing the traditional figure. */
  connections: ReadonlyArray<readonly [number, number]>;
}

/* ------------------------------------------------------------------ */
/*  3 stars                                                            */
/* ------------------------------------------------------------------ */

const TRIANGULUM: ConstellationFigure = {
  name: "Triangulum",
  stars: [
    { name: "Mothallah (α Tri)", raH: 1.8846, decDeg: 29.58, spectralClass: "F", magnitude: 3.41 },
    { name: "β Tri", raH: 2.1596, decDeg: 34.99, spectralClass: "A", magnitude: 3.0 },
    { name: "γ Tri", raH: 2.2891, decDeg: 33.85, spectralClass: "A", magnitude: 4.01 },
  ],
  connections: [
    [0, 1],
    [1, 2],
    [2, 0],
  ],
};

/* ------------------------------------------------------------------ */
/*  4 stars                                                            */
/* ------------------------------------------------------------------ */

/** The Southern Cross. Two crossing arms, so the figure is two segments. */
const CRUX: ConstellationFigure = {
  name: "Crux",
  stars: [
    { name: "Acrux (α Cru)", raH: 12.4433, decDeg: -63.1, spectralClass: "B", magnitude: 0.77 },
    { name: "Mimosa (β Cru)", raH: 12.7953, decDeg: -59.69, spectralClass: "B", magnitude: 1.25 },
    { name: "Gacrux (γ Cru)", raH: 12.5194, decDeg: -57.11, spectralClass: "M", magnitude: 1.63, isRedGiantAccent: true },
    { name: "Imai (δ Cru)", raH: 12.2525, decDeg: -58.75, spectralClass: "B", magnitude: 2.79 },
  ],
  connections: [
    [0, 2],
    [1, 3],
  ],
};

const SAGITTA: ConstellationFigure = {
  name: "Sagitta",
  stars: [
    { name: "Sham (α Sge)", raH: 19.6683, decDeg: 18.01, spectralClass: "G", magnitude: 4.37 },
    { name: "β Sge", raH: 19.6853, decDeg: 17.48, spectralClass: "G", magnitude: 4.37 },
    { name: "δ Sge", raH: 19.79, decDeg: 18.53, spectralClass: "M", magnitude: 3.82 },
    { name: "γ Sge", raH: 19.9789, decDeg: 19.49, spectralClass: "K", magnitude: 3.51 },
  ],
  connections: [
    [0, 2],
    [1, 2],
    [2, 3],
  ],
};

/* ------------------------------------------------------------------ */
/*  5 stars                                                            */
/* ------------------------------------------------------------------ */

const CASSIOPEIA: ConstellationFigure = {
  name: "Cassiopeia",
  stars: [
    { name: "Segin (ε Cas)", raH: 1.9, decDeg: 63.67, spectralClass: "B", magnitude: 3.38 },
    { name: "Ruchbah (δ Cas)", raH: 1.45, decDeg: 60.24, spectralClass: "A", magnitude: 2.68 },
    { name: "γ Cas", raH: 0.95, decDeg: 60.72, spectralClass: "B", magnitude: 2.47 },
    { name: "Schedar (α Cas)", raH: 0.67, decDeg: 56.54, spectralClass: "K", magnitude: 2.24 },
    { name: "Caph (β Cas)", raH: 0.15, decDeg: 59.15, spectralClass: "F", magnitude: 2.28 },
  ],
  // The real W.
  connections: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ],
};

const CORVUS: ConstellationFigure = {
  name: "Corvus",
  stars: [
    { name: "Gienah (γ Crv)", raH: 12.2634, decDeg: -17.54, spectralClass: "B", magnitude: 2.59 },
    { name: "Algorab (δ Crv)", raH: 12.4979, decDeg: -16.52, spectralClass: "B", magnitude: 2.95 },
    { name: "Kraz (β Crv)", raH: 12.5721, decDeg: -23.4, spectralClass: "G", magnitude: 2.65 },
    { name: "Minkar (ε Crv)", raH: 12.1683, decDeg: -22.62, spectralClass: "K", magnitude: 3.02 },
    { name: "Alchiba (α Crv)", raH: 12.1405, decDeg: -24.73, spectralClass: "F", magnitude: 4.02 },
  ],
  connections: [
    [4, 3],
    [3, 0],
    [0, 1],
    [1, 2],
    [2, 3],
  ],
};

const DELPHINUS: ConstellationFigure = {
  name: "Delphinus",
  stars: [
    { name: "Rotanev (β Del)", raH: 20.6255, decDeg: 14.6, spectralClass: "F", magnitude: 3.63 },
    { name: "Sualocin (α Del)", raH: 20.6607, decDeg: 15.91, spectralClass: "B", magnitude: 3.77 },
    { name: "γ Del", raH: 20.7758, decDeg: 16.12, spectralClass: "K", magnitude: 4.27 },
    { name: "δ Del", raH: 20.7325, decDeg: 15.07, spectralClass: "A", magnitude: 4.43 },
    { name: "ε Del", raH: 20.5566, decDeg: 11.3, spectralClass: "B", magnitude: 4.03 },
  ],
  connections: [
    [4, 0],
    [0, 3],
    [3, 2],
    [2, 1],
    [1, 0],
  ],
};

const CEPHEUS: ConstellationFigure = {
  name: "Cepheus",
  stars: [
    { name: "Alderamin (α Cep)", raH: 21.3096, decDeg: 62.59, spectralClass: "A", magnitude: 2.45 },
    { name: "Alfirk (β Cep)", raH: 21.4776, decDeg: 70.56, spectralClass: "B", magnitude: 3.23 },
    { name: "Errai (γ Cep)", raH: 23.6558, decDeg: 77.63, spectralClass: "K", magnitude: 3.21 },
    { name: "ι Cep", raH: 22.8288, decDeg: 66.2, spectralClass: "K", magnitude: 3.52 },
    { name: "ζ Cep", raH: 22.1809, decDeg: 58.2, spectralClass: "K", magnitude: 3.35 },
  ],
  // The house.
  connections: [
    [4, 0],
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ],
};

/* ------------------------------------------------------------------ */
/*  6 stars                                                            */
/* ------------------------------------------------------------------ */

const LYRA: ConstellationFigure = {
  name: "Lyra",
  stars: [
    { name: "Vega (α Lyr)", raH: 18.6156, decDeg: 38.78, spectralClass: "A", magnitude: 0.03 },
    { name: "ζ¹ Lyr", raH: 18.7461, decDeg: 37.6, spectralClass: "A", magnitude: 4.36 },
    { name: "Sheliak (β Lyr)", raH: 18.8347, decDeg: 33.36, spectralClass: "B", magnitude: 3.52 },
    { name: "Sulafat (γ Lyr)", raH: 18.9822, decDeg: 32.69, spectralClass: "B", magnitude: 3.24 },
    { name: "δ² Lyr", raH: 18.9, decDeg: 36.9, spectralClass: "M", magnitude: 4.3 },
    { name: "ε Lyr", raH: 18.7392, decDeg: 39.67, spectralClass: "A", magnitude: 4.6 },
  ],
  connections: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 1],
    [0, 5],
  ],
};

const CORONA_BOREALIS: ConstellationFigure = {
  name: "Corona Borealis",
  stars: [
    { name: "Alphecca (α CrB)", raH: 15.5781, decDeg: 26.71, spectralClass: "A", magnitude: 2.22 },
    { name: "Nusakan (β CrB)", raH: 15.4638, decDeg: 29.11, spectralClass: "F", magnitude: 3.68 },
    { name: "γ CrB", raH: 15.7108, decDeg: 26.3, spectralClass: "B", magnitude: 3.84 },
    { name: "θ CrB", raH: 15.5486, decDeg: 31.36, spectralClass: "B", magnitude: 4.14 },
    { name: "δ CrB", raH: 15.8267, decDeg: 26.07, spectralClass: "G", magnitude: 4.63 },
    { name: "ε CrB", raH: 15.9585, decDeg: 26.88, spectralClass: "K", magnitude: 4.15 },
  ],
  connections: [
    [3, 1],
    [1, 0],
    [0, 2],
    [2, 4],
    [4, 5],
  ],
};

const CYGNUS: ConstellationFigure = {
  name: "Cygnus",
  stars: [
    { name: "Deneb (α Cyg)", raH: 20.6905, decDeg: 45.28, spectralClass: "A", magnitude: 1.25 },
    { name: "Sadr (γ Cyg)", raH: 20.3705, decDeg: 40.26, spectralClass: "F", magnitude: 2.23 },
    { name: "δ Cyg", raH: 19.7495, decDeg: 45.13, spectralClass: "B", magnitude: 2.87 },
    { name: "Gienah (ε Cyg)", raH: 20.7702, decDeg: 33.97, spectralClass: "K", magnitude: 2.48 },
    { name: "Albireo (β Cyg)", raH: 19.5121, decDeg: 27.96, spectralClass: "K", magnitude: 3.08 },
    { name: "ζ Cyg", raH: 21.2149, decDeg: 30.23, spectralClass: "G", magnitude: 3.2 },
  ],
  // The Northern Cross.
  connections: [
    [0, 1],
    [1, 3],
    [1, 2],
    [1, 4],
    [3, 5],
  ],
};

const AURIGA: ConstellationFigure = {
  name: "Auriga",
  stars: [
    { name: "Capella (α Aur)", raH: 5.2782, decDeg: 45.998, spectralClass: "G", magnitude: 0.08 },
    { name: "Menkalinan (β Aur)", raH: 5.9922, decDeg: 44.95, spectralClass: "A", magnitude: 1.9 },
    { name: "Mahasim (θ Aur)", raH: 5.9953, decDeg: 37.21, spectralClass: "A", magnitude: 2.62 },
    { name: "Hassaleh (ι Aur)", raH: 4.9497, decDeg: 33.17, spectralClass: "K", magnitude: 2.69 },
    { name: "Almaaz (ε Aur)", raH: 5.0328, decDeg: 43.82, spectralClass: "F", magnitude: 3.03 },
    { name: "η Aur", raH: 5.1083, decDeg: 41.23, spectralClass: "B", magnitude: 3.17 },
  ],
  connections: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 5],
    [5, 4],
    [4, 0],
  ],
};

/* ------------------------------------------------------------------ */
/*  7 stars                                                            */
/* ------------------------------------------------------------------ */

/** The Big Dipper — bowl of four, handle of three. */
const URSA_MAJOR: ConstellationFigure = {
  name: "Ursa Major",
  stars: [
    { name: "Dubhe (α UMa)", raH: 11.0621, decDeg: 61.75, spectralClass: "K", magnitude: 1.79 },
    { name: "Merak (β UMa)", raH: 11.0307, decDeg: 56.38, spectralClass: "A", magnitude: 2.37 },
    { name: "Phecda (γ UMa)", raH: 11.8972, decDeg: 53.69, spectralClass: "A", magnitude: 2.44 },
    { name: "Megrez (δ UMa)", raH: 12.2571, decDeg: 57.03, spectralClass: "A", magnitude: 3.31 },
    { name: "Alioth (ε UMa)", raH: 12.9005, decDeg: 55.96, spectralClass: "A", magnitude: 1.77 },
    { name: "Mizar (ζ UMa)", raH: 13.3988, decDeg: 54.93, spectralClass: "A", magnitude: 2.23 },
    { name: "Alkaid (η UMa)", raH: 13.7923, decDeg: 49.31, spectralClass: "B", magnitude: 1.86 },
  ],
  connections: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [3, 4],
    [4, 5],
    [5, 6],
  ],
};

/** The Little Dipper, hung from Polaris. */
const URSA_MINOR: ConstellationFigure = {
  name: "Ursa Minor",
  stars: [
    { name: "Polaris (α UMi)", raH: 2.5303, decDeg: 89.26, spectralClass: "F", magnitude: 1.98 },
    { name: "δ UMi", raH: 17.5372, decDeg: 86.59, spectralClass: "A", magnitude: 4.36 },
    { name: "ε UMi", raH: 16.766, decDeg: 82.04, spectralClass: "G", magnitude: 4.23 },
    { name: "ζ UMi", raH: 15.7345, decDeg: 77.79, spectralClass: "A", magnitude: 4.32 },
    { name: "η UMi", raH: 16.2917, decDeg: 75.755, spectralClass: "F", magnitude: 4.95 },
    { name: "Pherkad (γ UMi)", raH: 15.3453, decDeg: 71.83, spectralClass: "A", magnitude: 3.05 },
    { name: "Kochab (β UMi)", raH: 14.845, decDeg: 74.16, spectralClass: "K", magnitude: 2.08 },
  ],
  connections: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 3],
  ],
};

/** The Kite, anchored on Arcturus. */
const BOOTES: ConstellationFigure = {
  name: "Bootes",
  stars: [
    { name: "Arcturus (α Boo)", raH: 14.261, decDeg: 19.18, spectralClass: "K", magnitude: -0.05 },
    { name: "Izar (ε Boo)", raH: 14.7498, decDeg: 27.07, spectralClass: "K", magnitude: 2.37 },
    { name: "Seginus (γ Boo)", raH: 14.5342, decDeg: 38.31, spectralClass: "A", magnitude: 3.03 },
    { name: "ρ Boo", raH: 14.5307, decDeg: 30.37, spectralClass: "K", magnitude: 3.58 },
    { name: "Muphrid (η Boo)", raH: 13.9114, decDeg: 18.4, spectralClass: "G", magnitude: 2.68 },
    { name: "δ Boo", raH: 15.258, decDeg: 33.31, spectralClass: "G", magnitude: 3.47 },
    { name: "Nekkar (β Boo)", raH: 15.0322, decDeg: 40.39, spectralClass: "G", magnitude: 3.49 },
  ],
  connections: [
    [0, 3],
    [3, 2],
    [2, 6],
    [6, 5],
    [5, 1],
    [1, 0],
    [0, 4],
  ],
};

/* ------------------------------------------------------------------ */
/*  8 stars                                                            */
/* ------------------------------------------------------------------ */

const AQUILA: ConstellationFigure = {
  name: "Aquila",
  stars: [
    { name: "Altair (α Aql)", raH: 19.8464, decDeg: 8.87, spectralClass: "A", magnitude: 0.77 },
    { name: "Tarazed (γ Aql)", raH: 19.7709, decDeg: 10.61, spectralClass: "K", magnitude: 2.72 },
    { name: "Alshain (β Aql)", raH: 19.9219, decDeg: 6.41, spectralClass: "G", magnitude: 3.71 },
    { name: "δ Aql", raH: 19.4251, decDeg: 3.11, spectralClass: "F", magnitude: 3.36 },
    { name: "Okab (ζ Aql)", raH: 19.0904, decDeg: 13.86, spectralClass: "A", magnitude: 2.99 },
    { name: "θ Aql", raH: 20.1882, decDeg: -0.82, spectralClass: "B", magnitude: 3.23 },
    { name: "η Aql", raH: 19.8735, decDeg: 1.01, spectralClass: "F", magnitude: 3.87 },
    { name: "ε Aql", raH: 18.9939, decDeg: 15.07, spectralClass: "K", magnitude: 4.02 },
  ],
  connections: [
    [1, 0],
    [0, 2],
    [1, 4],
    [4, 7],
    [0, 3],
    [3, 6],
    [6, 5],
  ],
};

const PERSEUS: ConstellationFigure = {
  name: "Perseus",
  stars: [
    { name: "Mirfak (α Per)", raH: 3.4054, decDeg: 49.86, spectralClass: "F", magnitude: 1.79 },
    { name: "Algol (β Per)", raH: 3.1361, decDeg: 40.96, spectralClass: "B", magnitude: 2.12 },
    { name: "γ Per", raH: 3.0797, decDeg: 53.51, spectralClass: "G", magnitude: 2.93 },
    { name: "δ Per", raH: 3.715, decDeg: 47.79, spectralClass: "B", magnitude: 3.01 },
    { name: "ε Per", raH: 3.9642, decDeg: 40.01, spectralClass: "B", magnitude: 2.89 },
    { name: "Atik (ζ Per)", raH: 3.9022, decDeg: 31.88, spectralClass: "B", magnitude: 2.85 },
    { name: "Miram (η Per)", raH: 2.8447, decDeg: 55.9, spectralClass: "K", magnitude: 3.76 },
    { name: "ρ Per", raH: 3.0805, decDeg: 38.84, spectralClass: "M", magnitude: 3.39, isRedGiantAccent: true },
  ],
  connections: [
    [6, 2],
    [2, 0],
    [0, 3],
    [3, 4],
    [4, 5],
    [0, 1],
    [1, 7],
  ],
};

const PEGASUS: ConstellationFigure = {
  name: "Pegasus",
  stars: [
    { name: "Markab (α Peg)", raH: 23.0794, decDeg: 15.21, spectralClass: "B", magnitude: 2.48 },
    { name: "Scheat (β Peg)", raH: 23.0629, decDeg: 28.08, spectralClass: "M", magnitude: 2.42, isRedGiantAccent: true },
    { name: "Algenib (γ Peg)", raH: 0.2206, decDeg: 15.18, spectralClass: "B", magnitude: 2.83 },
    { name: "Enif (ε Peg)", raH: 21.7364, decDeg: 9.88, spectralClass: "K", magnitude: 2.38 },
    { name: "Homam (ζ Peg)", raH: 22.691, decDeg: 10.83, spectralClass: "B", magnitude: 3.4 },
    { name: "Matar (η Peg)", raH: 22.7169, decDeg: 30.22, spectralClass: "G", magnitude: 2.94 },
    { name: "Baham (θ Peg)", raH: 22.17, decDeg: 6.2, spectralClass: "A", magnitude: 3.53 },
    { name: "Sadalbari (μ Peg)", raH: 22.83, decDeg: 24.6, spectralClass: "G", magnitude: 3.48 },
  ],
  connections: [
    [0, 1],
    [1, 5],
    [5, 7],
    [0, 4],
    [4, 6],
    [6, 3],
    [0, 2],
  ],
};

/* ------------------------------------------------------------------ */
/*  9 stars                                                            */
/* ------------------------------------------------------------------ */

/**
 * Orion, as the recognizable hunter.
 *
 * `3d/asterism-data.ts` carries a 29-member Orion, padded so the old 3D scene
 * could give every lesson its own star. The padding was never drawn — only these
 * nine are connected — so it produced twenty members that existed and did
 * nothing. Sizing is `assignFigures`' job now, and this is the figure.
 */
const ORION: ConstellationFigure = {
  name: "Orion",
  stars: [
    { name: "Betelgeuse (α Ori)", raH: 5.9167, decDeg: 7.41, spectralClass: "M", magnitude: 0.42, isRedGiantAccent: true },
    { name: "Bellatrix (γ Ori)", raH: 5.4188, decDeg: 6.35, spectralClass: "B", magnitude: 1.64 },
    { name: "Alnitak (ζ Ori)", raH: 5.6793, decDeg: -1.94, spectralClass: "O", magnitude: 1.88 },
    { name: "Alnilam (ε Ori)", raH: 5.6036, decDeg: -1.2, spectralClass: "B", magnitude: 1.69 },
    { name: "Mintaka (δ Ori)", raH: 5.5334, decDeg: -0.3, spectralClass: "O", magnitude: 2.23 },
    { name: "Saiph (κ Ori)", raH: 5.7959, decDeg: -9.67, spectralClass: "B", magnitude: 2.06 },
    { name: "Rigel (β Ori)", raH: 5.2423, decDeg: -8.2, spectralClass: "B", magnitude: 0.18 },
    { name: "Meissa (λ Ori)", raH: 5.5855, decDeg: 9.93, spectralClass: "O", magnitude: 3.39 },
    { name: "M42 (Orion Nebula)", raH: 5.5881, decDeg: -5.39, spectralClass: "B", magnitude: 4.0, isNebula: true },
  ],
  connections: [
    [0, 2],
    [1, 4],
    [2, 3],
    [3, 4],
    [2, 5],
    [4, 6],
    [2, 8],
    [4, 8],
    [7, 0],
    [7, 1],
  ],
};

const LEO: ConstellationFigure = {
  name: "Leo",
  stars: [
    { name: "Regulus (α Leo)", raH: 10.1395, decDeg: 11.97, spectralClass: "B", magnitude: 1.36 },
    { name: "Denebola (β Leo)", raH: 11.8177, decDeg: 14.57, spectralClass: "A", magnitude: 2.14 },
    { name: "Algieba (γ Leo)", raH: 10.3329, decDeg: 19.84, spectralClass: "K", magnitude: 2.08 },
    { name: "Zosma (δ Leo)", raH: 11.2351, decDeg: 20.52, spectralClass: "A", magnitude: 2.56 },
    { name: "Chertan (θ Leo)", raH: 11.2372, decDeg: 15.43, spectralClass: "A", magnitude: 3.33 },
    { name: "Adhafera (ζ Leo)", raH: 10.2782, decDeg: 23.42, spectralClass: "F", magnitude: 3.44 },
    { name: "η Leo", raH: 10.1222, decDeg: 16.76, spectralClass: "A", magnitude: 3.51 },
    { name: "Algenubi (ε Leo)", raH: 9.7643, decDeg: 23.77, spectralClass: "G", magnitude: 2.98 },
    { name: "Rasalas (μ Leo)", raH: 9.8792, decDeg: 26.01, spectralClass: "K", magnitude: 3.88 },
  ],
  // The Sickle, then the hindquarters triangle.
  connections: [
    [0, 6],
    [6, 2],
    [2, 5],
    [5, 8],
    [8, 7],
    [0, 4],
    [4, 3],
    [3, 1],
    [3, 2],
  ],
};

/* ------------------------------------------------------------------ */
/*  10 stars                                                           */
/* ------------------------------------------------------------------ */

const GEMINI: ConstellationFigure = {
  name: "Gemini",
  stars: [
    { name: "Castor (α Gem)", raH: 7.5766, decDeg: 31.89, spectralClass: "A", magnitude: 1.58 },
    { name: "Pollux (β Gem)", raH: 7.7553, decDeg: 28.03, spectralClass: "K", magnitude: 1.14 },
    { name: "Alhena (γ Gem)", raH: 6.6285, decDeg: 16.4, spectralClass: "A", magnitude: 1.93 },
    { name: "Wasat (δ Gem)", raH: 7.3353, decDeg: 21.98, spectralClass: "F", magnitude: 3.53 },
    { name: "Mebsuta (ε Gem)", raH: 6.732, decDeg: 25.13, spectralClass: "G", magnitude: 2.98 },
    { name: "Mekbuda (ζ Gem)", raH: 7.0684, decDeg: 20.57, spectralClass: "G", magnitude: 3.79 },
    { name: "Propus (η Gem)", raH: 6.2478, decDeg: 22.51, spectralClass: "M", magnitude: 3.28, isRedGiantAccent: true },
    { name: "Tejat (μ Gem)", raH: 6.3826, decDeg: 22.51, spectralClass: "M", magnitude: 2.87 },
    { name: "Alzirr (ξ Gem)", raH: 6.7549, decDeg: 12.9, spectralClass: "F", magnitude: 3.36 },
    { name: "λ Gem", raH: 7.429, decDeg: 16.54, spectralClass: "A", magnitude: 3.58 },
  ],
  connections: [
    [0, 1],
    [0, 4],
    [4, 7],
    [7, 6],
    [1, 3],
    [3, 5],
    [5, 2],
    [3, 9],
    [9, 8],
  ],
};

/* ------------------------------------------------------------------ */
/*  11 stars                                                           */
/* ------------------------------------------------------------------ */

const TAURUS: ConstellationFigure = {
  name: "Taurus",
  stars: [
    { name: "Aldebaran (α Tau)", raH: 4.5987, decDeg: 16.51, spectralClass: "K", magnitude: 0.85, isRedGiantAccent: true },
    { name: "Elnath (β Tau)", raH: 5.4382, decDeg: 28.61, spectralClass: "B", magnitude: 1.65 },
    { name: "Tianguan (ζ Tau)", raH: 5.6274, decDeg: 21.14, spectralClass: "B", magnitude: 3.0 },
    { name: "Hyadum I (γ Tau)", raH: 4.3299, decDeg: 15.63, spectralClass: "K", magnitude: 3.65 },
    { name: "Hyadum II (δ Tau)", raH: 4.382, decDeg: 17.54, spectralClass: "K", magnitude: 3.76 },
    { name: "Ain (ε Tau)", raH: 4.4776, decDeg: 19.18, spectralClass: "K", magnitude: 3.53 },
    { name: "θ Tau", raH: 4.4784, decDeg: 15.87, spectralClass: "A", magnitude: 3.4 },
    { name: "λ Tau", raH: 4.0113, decDeg: 12.49, spectralClass: "B", magnitude: 3.47 },
    { name: "ξ Tau", raH: 3.4531, decDeg: 9.73, spectralClass: "B", magnitude: 3.74 },
    { name: "ο Tau", raH: 3.4131, decDeg: 9.03, spectralClass: "G", magnitude: 3.61 },
    { name: "ν Tau", raH: 4.0455, decDeg: 5.99, spectralClass: "A", magnitude: 3.91 },
  ],
  // The Hyades V, the two horns, and the forelegs.
  connections: [
    [0, 5],
    [5, 1],
    [0, 6],
    [6, 3],
    [3, 4],
    [4, 5],
    [0, 2],
    [3, 7],
    [7, 8],
    [8, 9],
    [7, 10],
  ],
};

/* ------------------------------------------------------------------ */
/*  13 stars                                                           */
/* ------------------------------------------------------------------ */

const SCORPIUS: ConstellationFigure = {
  name: "Scorpius",
  stars: [
    { name: "Antares (α Sco)", raH: 16.4901, decDeg: -26.43, spectralClass: "M", magnitude: 1.06, isRedGiantAccent: true },
    { name: "Graffias (β Sco)", raH: 16.0906, decDeg: -19.81, spectralClass: "B", magnitude: 2.56 },
    { name: "Dschubba (δ Sco)", raH: 16.0056, decDeg: -22.62, spectralClass: "B", magnitude: 2.29 },
    { name: "Fang (π Sco)", raH: 15.981, decDeg: -26.11, spectralClass: "B", magnitude: 2.89 },
    { name: "Alniyat (σ Sco)", raH: 16.3536, decDeg: -25.59, spectralClass: "B", magnitude: 2.9 },
    { name: "Paikauhale (τ Sco)", raH: 16.5981, decDeg: -28.22, spectralClass: "B", magnitude: 2.82 },
    { name: "Larawag (ε Sco)", raH: 16.8361, decDeg: -34.29, spectralClass: "K", magnitude: 2.29 },
    { name: "Xamidimura (μ Sco)", raH: 16.8642, decDeg: -38.05, spectralClass: "B", magnitude: 3.0 },
    { name: "Fuyue (ζ Sco)", raH: 16.913, decDeg: -42.36, spectralClass: "B", magnitude: 3.62 },
    { name: "η Sco", raH: 17.2029, decDeg: -43.24, spectralClass: "F", magnitude: 3.32 },
    { name: "Sargas (θ Sco)", raH: 17.6221, decDeg: -42.99, spectralClass: "F", magnitude: 1.86 },
    { name: "Apollyon (ι Sco)", raH: 17.7932, decDeg: -40.13, spectralClass: "F", magnitude: 2.99 },
    { name: "Shaula (λ Sco)", raH: 17.5601, decDeg: -37.1, spectralClass: "B", magnitude: 1.62 },
  ],
  // Claws, heart, then the curl of the tail to the sting.
  connections: [
    [1, 2],
    [2, 3],
    [2, 4],
    [4, 0],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 11],
    [11, 12],
  ],
};

/* ------------------------------------------------------------------ */
/*  14 stars                                                           */
/* ------------------------------------------------------------------ */

const DRACO: ConstellationFigure = {
  name: "Draco",
  stars: [
    { name: "Giausar (λ Dra)", raH: 11.5311, decDeg: 69.33, spectralClass: "M", magnitude: 3.84, isRedGiantAccent: true },
    { name: "κ Dra", raH: 12.5561, decDeg: 69.79, spectralClass: "B", magnitude: 3.87 },
    { name: "Thuban (α Dra)", raH: 14.0731, decDeg: 64.38, spectralClass: "A", magnitude: 3.65 },
    { name: "Edasich (ι Dra)", raH: 15.4155, decDeg: 58.97, spectralClass: "K", magnitude: 3.29 },
    { name: "θ Dra", raH: 16.032, decDeg: 58.56, spectralClass: "F", magnitude: 4.01 },
    { name: "Athebyne (η Dra)", raH: 16.3999, decDeg: 61.51, spectralClass: "G", magnitude: 2.74 },
    { name: "Aldhibah (ζ Dra)", raH: 17.1461, decDeg: 65.71, spectralClass: "B", magnitude: 3.17 },
    { name: "χ Dra", raH: 18.3444, decDeg: 72.73, spectralClass: "F", magnitude: 3.57 },
    { name: "Altais (δ Dra)", raH: 19.2093, decDeg: 67.66, spectralClass: "G", magnitude: 3.07 },
    { name: "Tyl (ε Dra)", raH: 19.802, decDeg: 70.27, spectralClass: "G", magnitude: 3.83 },
    { name: "Grumium (ξ Dra)", raH: 17.8924, decDeg: 56.87, spectralClass: "K", magnitude: 3.75 },
    { name: "Kuma (ν Dra)", raH: 17.5372, decDeg: 55.18, spectralClass: "A", magnitude: 4.88 },
    { name: "Rastaban (β Dra)", raH: 17.5072, decDeg: 52.3, spectralClass: "G", magnitude: 2.79 },
    { name: "Eltanin (γ Dra)", raH: 17.9434, decDeg: 51.49, spectralClass: "K", magnitude: 2.23 },
  ],
  // The long body, then the quadrilateral of the head.
  connections: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [8, 10],
    [10, 11],
    [11, 12],
    [12, 13],
    [13, 10],
  ],
};

/**
 * Every figure a course can draw, ascending by star count.
 *
 * Ordered so `assignFigures` can scan for a size match, and so the spread of
 * available sizes is obvious when adding one. Adding a figure is ~15 lines of
 * catalogue coordinates plus its connection list.
 */
export const CONSTELLATION_FIGURES: readonly ConstellationFigure[] = [
  TRIANGULUM,
  CRUX,
  SAGITTA,
  CASSIOPEIA,
  CORVUS,
  DELPHINUS,
  CEPHEUS,
  LYRA,
  CORONA_BOREALIS,
  CYGNUS,
  AURIGA,
  URSA_MAJOR,
  URSA_MINOR,
  BOOTES,
  AQUILA,
  PERSEUS,
  PEGASUS,
  ORION,
  LEO,
  GEMINI,
  TAURUS,
  SCORPIUS,
  DRACO,
];

/** How many stars a figure draws. Every catalogue member is drawn. */
export function figureSize(figure: ConstellationFigure): number {
  return figure.stars.length;
}

/** The largest course a figure can give one star per lesson to. */
export const LARGEST_FIGURE = CONSTELLATION_FIGURES.reduce(
  (max, f) => Math.max(max, f.stars.length),
  0,
);

export function figureByName(name: string): ConstellationFigure | null {
  return CONSTELLATION_FIGURES.find((f) => f.name === name) ?? null;
}

export interface ProjectedStar {
  name: string;
  /** `[x, y, 0]`. The tuple keeps the shape the renderer already reads. */
  position: [number, number, number];
  spectralClass: SpectralClass;
  magnitude: number;
  isRedGiantAccent?: boolean;
  isNebula?: boolean;
}

/**
 * RA/Dec → a flat plane, centred on the figure and scaled to a unit-ish box.
 *
 * RA is flipped because the sky is seen from inside: higher RA (east) belongs on
 * the left, which is what makes Orion read with Betelgeuse upper-left. Declination
 * is used directly — a proper projection would scale RA by `cos(dec)`, and this
 * deliberately does not, because the renderer normalises each figure into its own
 * bounding box anyway, so the only thing that survives is relative shape.
 *
 * Unlike the 3D projection this carries no depth: the chart is flat, and a z
 * offset there existed only to give the camera parallax.
 *
 * Deterministic — the same figure always projects identically.
 */
export function projectFigure(figure: ConstellationFigure): ProjectedStar[] {
  const { stars } = figure;
  if (stars.length === 0) return [];

  const raDeg = stars.map((s) => s.raH * 15);
  const dec = stars.map((s) => s.decDeg);

  /*
   * Constellations that straddle RA 0h (Pegasus runs 21h→0.2h) would otherwise
   * get a ~350° span and collapse to a dot. Unwrap onto a continuous line first.
   */
  const spanRaw = Math.max(...raDeg) - Math.min(...raDeg);
  const ra = spanRaw > 180 ? raDeg.map((r) => (r < 180 ? r + 360 : r)) : raDeg;

  const cRa = ra.reduce((a, b) => a + b, 0) / ra.length;
  const cDec = dec.reduce((a, b) => a + b, 0) / dec.length;

  const xs = ra.map((r) => r - cRa);
  const ys = dec.map((d) => d - cDec);
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    1e-6,
  );
  const k = 6.5 / span;

  return stars.map((s, i) => ({
    name: s.name,
    position: [
      Number(((cRa - ra[i]!) * k).toFixed(3)),
      Number(((s.decDeg - cDec) * k).toFixed(3)),
      0,
    ],
    spectralClass: s.spectralClass,
    magnitude: s.magnitude,
    ...(s.isRedGiantAccent ? { isRedGiantAccent: true } : {}),
    ...(s.isNebula ? { isNebula: true } : {}),
  }));
}
