import { box, merge, type Voxel } from "@/lib/voxel";

/**
 * One character, many roles.
 *
 * Every figure is the same little person: a big square head, a small body,
 * hands on a laptop. Roles change the hat, the hair, the shirt and a prop,
 * which is how the same face can be the overwhelmed newcomer on the landing
 * page, the guide on onboarding, and the maintainer on an issue.
 *
 * Coordinates: the figure faces +x. Its face is the x = 3 plane. Width runs
 * along y, so "left" and "right" below are the figure's own left and right.
 */

export const PALETTE = {
  skin: "#f1c7a0",
  skinDeep: "#d9a67c",
  eye: "#2a2438",
  mouth: "#c98a72",
  laptop: "#c9cfd8",
  laptopBack: "#aeb6c2",
  laptopKeys: "#8e97a5",
  logo: "#7c5cff",
  desk: "#b98352",
  deskLeg: "#8c5e36",
  pants: "#2f2a41",
  hair: {
    black: "#262233",
    brown: "#6b4a2f",
    blonde: "#e6c17b",
    auburn: "#a34a2a",
    silver: "#b9bcc6",
  },
  shirt: {
    slate: "#3f3a55",
    iris: "#7c5cff",
    cyan: "#22d3ee",
    amber: "#f5b942",
    rose: "#f472b6",
    orange: "#fb923c",
    sky: "#60a5fa",
    violet: "#a78bfa",
    white: "#f4f1ea",
  },
  hat: {
    wizard: "#6d4de0",
    wizardBand: "#f5b942",
    star: "#ffe27a",
    crown: "#f5c542",
    beret: "#d9453a",
    beanie: "#f472b6",
    cap: "#22d3ee",
    hood: "#4b5563",
    hardhat: "#f5b942",
    headset: "#2a2438",
  },
  staff: "#7a4a2c",
  gem: "#22d3ee",
  glass: "#1c1a26",
  book: "#e05a6d",
  bookPages: "#f7f1e4",
} as const;

export type Role =
  | "newcomer"
  | "guide"
  | "crown"
  | "beret"
  | "beanie"
  | "cap"
  | "headset"
  | "hood"
  | "builder"
  | "reader";

export type FigureOptions = {
  role?: Role;
  /** Draw the laptop. On by default; the reader holds a book instead. */
  laptop?: boolean;
  /** Draw a desk in front. Only the landing scene wants one. */
  desk?: boolean;
  hair?: keyof typeof PALETTE.hair;
  shirt?: keyof typeof PALETTE.shirt;
};

/* --------------------------------------------------------------- parts */

function body(shirt: string): Voxel[] {
  return merge(
    // Lap, seated.
    box(0, 0, 0, 3, 3, 2, PALETTE.pants),
    // Torso.
    box(0, 0, 2, 2, 3, 4, shirt),
    // Arms reach forward to the keyboard, hands at the far end.
    box(0, -1, 4, 3, 1, 1, shirt),
    box(0, 3, 4, 3, 1, 1, shirt),
    box(3, -1, 4, 1, 1, 1, PALETTE.skin),
    box(3, 3, 4, 1, 1, 1, PALETTE.skin),
  );
}

/** A 5x5x5 head with eyes and a mouth on the +x face. */
function head(hair: string | null): Voxel[] {
  const parts: Voxel[][] = [box(-1, -1, 6, 5, 5, 5, PALETTE.skin)];
  if (hair) {
    parts.push(
      // Cap of hair on top, a column down the back, and a fringe over the brow.
      box(-1, -1, 11, 5, 5, 1, hair),
      box(-1, -1, 6, 1, 5, 5, hair),
      box(3, -1, 10, 1, 5, 1, hair),
      box(0, -1, 10, 3, 5, 1, hair),
    );
  }
  parts.push(
    box(3, 0, 8, 1, 1, 1, PALETTE.eye),
    box(3, 2, 8, 1, 1, 1, PALETTE.eye),
    box(3, 1, 7, 1, 1, 1, PALETTE.mouth),
  );
  return merge(...parts);
}

function laptop(): Voxel[] {
  return merge(
    box(3, -1, 3, 3, 5, 1, PALETTE.laptop),
    // Key rows, slightly darker, so the base reads as a keyboard.
    box(4, 0, 3, 1, 3, 1, PALETTE.laptopKeys),
    // Screen stands at the far edge; the viewer sees its back and the logo.
    box(5, -1, 4, 1, 5, 4, PALETTE.laptopBack),
    box(5, 1, 6, 1, 1, 1, PALETTE.logo),
  );
}

function desk(): Voxel[] {
  return merge(
    box(2, -3, 2, 6, 9, 1, PALETTE.desk),
    box(2, -3, 0, 1, 1, 2, PALETTE.deskLeg),
    box(7, -3, 0, 1, 1, 2, PALETTE.deskLeg),
    box(2, 5, 0, 1, 1, 2, PALETTE.deskLeg),
    box(7, 5, 0, 1, 1, 2, PALETTE.deskLeg),
  );
}

/* ----------------------------------------------------------------- hats */

function wizardHat(): Voxel[] {
  return merge(
    // Wide brim sits on the hair, then the cone narrows in steps.
    box(-2, -2, 11, 7, 7, 1, PALETTE.hat.wizard),
    box(-1, -1, 12, 5, 5, 1, PALETTE.hat.wizardBand),
    box(-1, -1, 13, 5, 5, 1, PALETTE.hat.wizard),
    box(0, 0, 14, 3, 3, 2, PALETTE.hat.wizard),
    box(1, 1, 16, 1, 1, 2, PALETTE.hat.wizard),
    // Stars.
    box(3, 0, 13, 1, 1, 1, PALETTE.hat.star),
    box(2, 2, 14, 1, 1, 1, PALETTE.hat.star),
    box(0, 3, 13, 1, 1, 1, PALETTE.hat.star),
  );
}

function staff(): Voxel[] {
  return merge(
    box(3, 5, 0, 1, 1, 12, PALETTE.staff),
    box(3, 5, 12, 1, 1, 1, PALETTE.gem),
    box(2, 5, 11, 1, 1, 1, PALETTE.staff),
    box(4, 5, 11, 1, 1, 1, PALETTE.staff),
  );
}

function crown(): Voxel[] {
  return merge(
    box(-1, -1, 11, 5, 5, 1, PALETTE.hat.crown),
    box(-1, -1, 12, 1, 1, 1, PALETTE.hat.crown),
    box(3, -1, 12, 1, 1, 1, PALETTE.hat.crown),
    box(-1, 3, 12, 1, 1, 1, PALETTE.hat.crown),
    box(3, 3, 12, 1, 1, 1, PALETTE.hat.crown),
    box(1, 1, 12, 1, 1, 1, PALETTE.gem),
  );
}

function beret(): Voxel[] {
  return merge(
    box(-2, -1, 11, 5, 5, 1, PALETTE.hat.beret),
    box(-1, 0, 12, 3, 3, 1, PALETTE.hat.beret),
    box(0, 1, 13, 1, 1, 1, PALETTE.hat.beret),
  );
}

function beanie(): Voxel[] {
  return merge(
    box(-1, -1, 10, 5, 5, 3, PALETTE.hat.beanie),
    box(0, 0, 13, 3, 3, 1, PALETTE.hat.beanie),
    box(1, 1, 14, 1, 1, 1, PALETTE.shirt.white),
  );
}

function capAndShades(): Voxel[] {
  return merge(
    box(-1, -1, 11, 5, 5, 1, PALETTE.hat.cap),
    box(-1, -1, 12, 4, 5, 1, PALETTE.hat.cap),
    // Peak.
    box(4, -1, 11, 2, 5, 1, PALETTE.hat.cap),
    // Sunglasses replace the eyes with one dark bar.
    box(3, -1, 8, 1, 5, 1, PALETTE.glass),
  );
}

function headset(): Voxel[] {
  return merge(
    box(0, -1, 11, 3, 5, 1, PALETTE.hat.headset),
    box(0, -2, 7, 3, 1, 3, PALETTE.hat.headset),
    box(0, 4, 7, 3, 1, 3, PALETTE.hat.headset),
    // Mic boom.
    box(3, -2, 7, 1, 1, 1, PALETTE.hat.headset),
    box(3, -1, 7, 1, 1, 1, PALETTE.hat.headset),
  );
}

function hood(): Voxel[] {
  return merge(
    box(-2, -2, 11, 6, 7, 1, PALETTE.hat.hood),
    box(-2, -2, 6, 1, 7, 6, PALETTE.hat.hood),
    box(-1, -2, 6, 5, 1, 6, PALETTE.hat.hood),
    box(-1, 4, 6, 5, 1, 6, PALETTE.hat.hood),
    box(0, -1, 12, 3, 5, 1, PALETTE.hat.hood),
  );
}

function hardHat(): Voxel[] {
  return merge(
    box(-2, -2, 11, 6, 7, 1, PALETTE.hat.hardhat),
    box(-1, -1, 12, 5, 5, 1, PALETTE.hat.hardhat),
    box(0, 0, 13, 3, 3, 1, PALETTE.hat.hardhat),
  );
}

function book(): Voxel[] {
  return merge(
    box(3, -1, 4, 2, 5, 1, PALETTE.book),
    box(3, 0, 5, 2, 3, 1, PALETTE.bookPages),
  );
}

/* --------------------------------------------------------------- figure */

const ROLE_DEFAULTS: Record<Role, { hair: keyof typeof PALETTE.hair | null; shirt: keyof typeof PALETTE.shirt }> = {
  newcomer: { hair: "black", shirt: "slate" },
  guide: { hair: "black", shirt: "iris" },
  crown: { hair: "blonde", shirt: "amber" },
  beret: { hair: "auburn", shirt: "rose" },
  beanie: { hair: "brown", shirt: "cyan" },
  cap: { hair: "black", shirt: "sky" },
  headset: { hair: null, shirt: "orange" },
  hood: { hair: "black", shirt: "violet" },
  builder: { hair: "brown", shirt: "amber" },
  reader: { hair: "silver", shirt: "white" },
};

export function figure(opts: FigureOptions = {}): Voxel[] {
  const role = opts.role ?? "newcomer";
  const d = ROLE_DEFAULTS[role];
  const hairKey = opts.hair ?? d.hair;
  const hair = hairKey ? PALETTE.hair[hairKey] : null;
  const shirt = PALETTE.shirt[opts.shirt ?? d.shirt];
  const withLaptop = opts.laptop ?? role !== "reader";

  const layers: Voxel[][] = [];
  if (opts.desk) layers.push(desk());
  layers.push(body(shirt), head(hair));
  if (withLaptop) layers.push(laptop());

  switch (role) {
    case "guide":
      layers.push(wizardHat(), staff());
      break;
    case "crown":
      layers.push(crown());
      break;
    case "beret":
      layers.push(beret());
      break;
    case "beanie":
      layers.push(beanie());
      break;
    case "cap":
      layers.push(capAndShades());
      break;
    case "headset":
      layers.push(headset());
      break;
    case "hood":
      layers.push(hood());
      break;
    case "builder":
      layers.push(hardHat());
      break;
    case "reader":
      layers.push(book());
      break;
  }

  return merge(...layers);
}
