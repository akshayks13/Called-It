/**
 * Display names, nicknames and roles for the 22 players, keyed by Cricsheet name.
 * Hand-written: Cricsheet only has scorecard names ("JJ Bumrah").
 */
export type Role = "bat" | "wk" | "ar" | "bowl";

export interface PlayerInfo {
  short: string;
  full: string;
  team: string;
  role: Role;
  /** regularly bowls, so the simulator may give them an over */
  bowls: boolean;
  /** lower-case names fans actually type */
  aliases: string[];
}

export const PLAYERS: Record<string, PlayerInfo> = {
  "RG Sharma": { short: "Rohit", full: "Rohit Sharma", team: "India", role: "bat", bowls: false, aliases: ["rohit", "sharma", "hitman", "rohit sharma"] },
  "V Kohli": { short: "Kohli", full: "Virat Kohli", team: "India", role: "bat", bowls: false, aliases: ["kohli", "virat", "king kohli", "king", "vk", "chiku", "cheeku"] },
  "RR Pant": { short: "Pant", full: "Rishabh Pant", team: "India", role: "wk", bowls: false, aliases: ["pant", "rishabh"] },
  "SA Yadav": { short: "SKY", full: "Suryakumar Yadav", team: "India", role: "bat", bowls: false, aliases: ["sky", "surya", "suryakumar", "surya kumar"] },
  "AR Patel": { short: "Axar", full: "Axar Patel", team: "India", role: "ar", bowls: true, aliases: ["axar", "akshar", "bapu", "patel"] },
  "S Dube": { short: "Dube", full: "Shivam Dube", team: "India", role: "ar", bowls: false, aliases: ["dube", "shivam"] },
  "HH Pandya": { short: "Hardik", full: "Hardik Pandya", team: "India", role: "ar", bowls: true, aliases: ["hardik", "pandya", "hp"] },
  "RA Jadeja": { short: "Jadeja", full: "Ravindra Jadeja", team: "India", role: "ar", bowls: true, aliases: ["jadeja", "jaddu", "ravindra", "sir jadeja"] },
  "Kuldeep Yadav": { short: "Kuldeep", full: "Kuldeep Yadav", team: "India", role: "bowl", bowls: true, aliases: ["kuldeep", "kuldip"] },
  "Arshdeep Singh": { short: "Arshdeep", full: "Arshdeep Singh", team: "India", role: "bowl", bowls: true, aliases: ["arshdeep", "arshdip", "arsh", "singh"] },
  "JJ Bumrah": { short: "Bumrah", full: "Jasprit Bumrah", team: "India", role: "bowl", bowls: true, aliases: ["bumrah", "bumra", "boom boom", "boom", "jasprit", "jassi"] },

  "RR Hendricks": { short: "Hendricks", full: "Reeza Hendricks", team: "South Africa", role: "bat", bowls: false, aliases: ["hendricks", "reeza"] },
  "Q de Kock": { short: "de Kock", full: "Quinton de Kock", team: "South Africa", role: "wk", bowls: false, aliases: ["de kock", "dekock", "quinton", "qdk", "quinny"] },
  "AK Markram": { short: "Markram", full: "Aiden Markram", team: "South Africa", role: "bat", bowls: false, aliases: ["markram", "aiden"] },
  "T Stubbs": { short: "Stubbs", full: "Tristan Stubbs", team: "South Africa", role: "bat", bowls: false, aliases: ["stubbs", "tristan"] },
  "H Klaasen": { short: "Klaasen", full: "Heinrich Klaasen", team: "South Africa", role: "bat", bowls: false, aliases: ["klaasen", "klassen", "klasen", "heinrich", "klaasy"] },
  "DA Miller": { short: "Miller", full: "David Miller", team: "South Africa", role: "bat", bowls: false, aliases: ["miller", "killer miller", "david"] },
  "M Jansen": { short: "Jansen", full: "Marco Jansen", team: "South Africa", role: "ar", bowls: true, aliases: ["jansen", "marco", "yansen"] },
  "KA Maharaj": { short: "Maharaj", full: "Keshav Maharaj", team: "South Africa", role: "bowl", bowls: true, aliases: ["maharaj", "keshav"] },
  "K Rabada": { short: "Rabada", full: "Kagiso Rabada", team: "South Africa", role: "bowl", bowls: true, aliases: ["rabada", "kagiso", "kg"] },
  "A Nortje": { short: "Nortje", full: "Anrich Nortje", team: "South Africa", role: "bowl", bowls: true, aliases: ["nortje", "nortye", "anrich"] },
  "T Shamsi": { short: "Shamsi", full: "Tabraiz Shamsi", team: "South Africa", role: "bowl", bowls: true, aliases: ["shamsi", "tabraiz"] },
};

export const TEAM_ALIASES: Record<string, string[]> = {
  India: ["india", "ind", "bharat", "team india", "men in blue", "indians"],
  "South Africa": ["south africa", "southafrica", "sa", "saf", "rsa", "proteas", "africa"],
};

export const TEAM_SHORT: Record<string, string> = { India: "IND", "South Africa": "SA" };

export const short = (id: string) => PLAYERS[id]?.short ?? id;
export const teamOf = (id: string) => PLAYERS[id]?.team;
export const teamShort = (team: string) => TEAM_SHORT[team] ?? team;
