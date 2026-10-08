/**
 * The real room, as data. Every size and position is in metres: y up, +z toward the doorway,
 * x = 0 at the middle of the window wall, which stays fixed at z = -1.65; changing `depth`
 * moves only the front wall (entry door and closet). Values come from docs/room/MY_ROOM_SPEC.md and are
 * estimates from photos until measured; nudge a number here and the geometry follows.
 */

export type Vec3 = [number, number, number];

export const ROOM = {
  width: 3.0,
  depth: 3.8,
  height: 2.44,
  wall: 0.12,
  get left() {
    return -this.width / 2;
  },
  get right() {
    return this.width / 2;
  },
  back: -1.65,
  get front() {
    return this.back + this.depth;
  },
  /** z of the middle of the floor */
  get midZ() {
    return this.back + this.depth / 2;
  },
};

/** window opening in the back wall */
export const WINDOW = { x0: -0.9, x1: 0.4, y0: 1.02, y1: 2.05, blindDown: 0.12 };

/**
 * Front wall, from photo E. The entry door sits in an alcove beside the desk wall, hinged on
 * the desk side and swinging into the room. The closet juts into the room from the bed side
 * of the wall up to that alcove, with a pair of six-panel doors.
 */
export const DOOR = { x0: 0.61, x1: 1.42, h: 2.03 };
export const CLOSET = { x0: -1.5, x1: 0.52, depth: 0.62, doorX0: -1.0, doorX1: 0.22, doorH: 2.03 };

export const COLORS = {
  wall: "#dcdad4",
  ceiling: "#e4e0d8",
  trim: "#efede8",
  carpet: "#34322f",
  carpetGrid: "#262523",
  maple: "#c8955f",
  dresser: "#d2a877",
  pull: "#141414",
  steel: "#1c1c1e",
  sheet: "#9e2427",
  blanket: "#c8161c",
  blanketStripe: "#3a080c",
  pillow: "#8f141b",
  deskTop: "#b89a78",
  blind: "#18191b",
  shade: "#f4eee2",
  tapestry: "#1c1b1c",
  chalk: "#e8e4dc",
};

export const LAYOUT = {
  bed: {
    /** centre of the mattress footprint */
    pos: [-0.79, 0, -0.66] as Vec3,
    mattress: { w: 1.37, l: 1.91, h: 0.2, top: 0.53 },
    frame: { w: 1.4, l: 1.95, h: 0.33 },
    /** its top stays just under the window sill */
    headboard: { w: 1.45, h: 0.97, t: 0.03 },
  },
  dresser: { pos: [0.28, 0, -1.42] as Vec3, w: 0.55, d: 0.45, unitH: 0.39 },
  /** centre of the black riser (0.44 × 0.22 m, four rows); its back row clears the window sill */
  perfume: { pos: [0.26, 0, -1.49] as Vec3 },
  candle: { pos: [0.05, 0, -1.3] as Vec3 },
  /** right in the corner of the window wall and the desk wall; the shade hangs out toward the room */
  floorLamp: { pos: [1.36, 0, -1.51] as Vec3, height: 1.62, shadeY: 1.48, shadeR: 0.15, shadeH: 0.22, shadeOffset: [-0.07, 0.07] as [number, number] },
  /** against the right wall, with about 0.75 m of open floor between its end and the window wall (photo F) */
  desk: { pos: [1.2, 0, ROOM.back + 0.75 + 0.6] as Vec3, l: 1.2, d: 0.6, h: 0.75 },
  /** square to the desk; everything is lined up and spaced so no footprints overlap (window end → room end:
   *  desk lamp and mug, laptop with the controller in front, speaker, monitor over keyboard and mouse, sunset lamp) */
  monitor: { pos: [1.32, 0, -0.12] as Vec3, w: 0.71, h: 0.42 },
  laptop: { pos: [1.25, 0, -0.66] as Vec3 },
  keyboard: { pos: [1.03, 0, -0.14] as Vec3 },
  mouse: { pos: [1.05, 0, 0.13] as Vec3 },
  controller: { pos: [0.99, 0, -0.62] as Vec3 },
  mug: { pos: [1.0, 0, -0.83] as Vec3 },
  /** the gooseneck lamp, with the clock in its base */
  deskLamp: { pos: [1.42, 0, -0.84] as Vec3 },
  speaker: { pos: [1.44, 0, -0.52] as Vec3 },
  /** a sunset lamp (it looked like a small speaker in the photos); it throws its orange disc onto the wall above the bed */
  sunsetLamp: { pos: [1.42, 0, 0.24] as Vec3, target: [-1.49, 1.6, 0.3] as Vec3 },
  /** the PS5, standing under the front end of the desk */
  pcTower: { pos: [1.25, 0, 0.06] as Vec3 },
  chair: { pos: [0.55, 0, -0.33] as Vec3, yaw: Math.PI / 2 },
  tapestry: { pos: [1.49, 1.72, -0.2] as Vec3, w: 1.3, h: 1.2 },
  /** flush-mount dome, off */
  ceilingLight: { pos: [-0.2, 0, 0.7] as Vec3, r: 0.17 },
  sprinkler: { pos: [0.3, 0, -0.95] as Vec3 },
  /** things on the window sill, left to right */
  sill: [
    { kind: "plant", x: -0.84 },
    { kind: "cow", x: -0.71 },
    { kind: "spiderHam", x: -0.56 },
    { kind: "cat", x: -0.4 },
    { kind: "bird", x: -0.28 },
    // in the open above the pillow, where they're easy to see and click from anywhere in the room
    { kind: "binoculars", x: -0.12 },
    { kind: "plant", x: 0.02 },
    { kind: "remote", x: 0.33 },
  ] as { kind: "plant" | "cow" | "spiderHam" | "cat" | "bird" | "binoculars" | "remote"; x: number }[],
  outlets: [
    { pos: [0.6, 0.42, -1.65] as Vec3, facing: "back" },
    { pos: [-1.5, 0.35, 1.1] as Vec3, facing: "left" },
    { pos: [1.5, 0.35, -1.2] as Vec3, facing: "right" },
    { pos: [1.5, 0.35, -0.95] as Vec3, facing: "right" },
  ] as { pos: Vec3; facing: "back" | "left" | "right" }[],
  /** on the closet's side face, facing the entry door alcove */
  lightSwitch: { pos: [0.52, 1.2, ROOM.front - 0.12] as Vec3 },
};

/** the opening camera, matching photo B: standing in front of the closet, looking at the window wall */
export const HERO = { pos: [0.62, 1.62, ROOM.front - CLOSET.depth - 0.12] as Vec3, target: [-0.2, 0.95, -1.65] as Vec3, fov: 68 };
