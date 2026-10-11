/**
 * The three demo friends. Everything they say is written here and ships with
 * the app, so they cost no AI requests. Their calls go through exactly the same
 * rating and settlement as the user's.
 *
 * `at` is the number of balls bowled when the line appears (0 = before the
 * first ball, 127 = innings break). Calls are always made before their outcome.
 */
import type { Claim } from "../claims/schema";
import type { Ball } from "../match/types";

export type FriendId = "rahul" | "priya" | "kabir";

export interface Friend {
  id: FriendId;
  name: string;
  /** one line shown on the board */
  blurb: string;
  color: string;
}

export const FRIENDS: Friend[] = [
  { id: "rahul", name: "Rahul", blurb: "India fan. Panics early.", color: "#5aa9ff" },
  { id: "priya", name: "Priya", blurb: "Watches the numbers.", color: "#f472b6" },
  { id: "kabir", name: "Kabir", blurb: "Loves a wild call.", color: "#fbbf24" },
];

export interface ScriptLine {
  at: number;
  by: FriendId;
  text: string;
  claim?: Claim;
  ifRight?: string;
  ifWrong?: string;
}

const IND = "India";
const SA = "South Africa";

export const SCRIPT: ScriptLine[] = [
  // ---- India bat ----
  {
    at: 0, by: "rahul", text: "Final hai boys 🙏 Kohli aaj 50 pakka",
    claim: { metric: "batter_runs", player: "V Kohli", op: "gte", value: 50, window: { type: "innings" }, basis: "total" },
    ifRight: "Final mein King. Rahul ne bola tha.", ifWrong: "Dil se bola tha, scoreboard ne nahi suna.",
  },
  {
    at: 2, by: "kabir", text: "Rohit goes big today. 30+ from him, easy",
    claim: { metric: "batter_runs", player: "RG Sharma", op: "gte", value: 30, window: { type: "innings" }, basis: "total" },
    ifRight: "Hitman delivered. So did Kabir.", ifWrong: "'Easy', he said. Rohit is back in the hut.",
  },
  {
    at: 12, by: "rahul", text: "23/2?? yeh toh gaya 😩 150 bhi nahi banega",
    claim: { metric: "innings_runs", team: IND, op: "lte", value: 149, window: { type: "innings" }, basis: "total" },
    ifRight: "Sad, but he did call it.", ifWrong: "150 bhi nahi banega? Ban gaya. Aur upar bhi.",
  },
  { at: 30, by: "priya", text: "3 down in the powerplay. Axar promoted, interesting" },
  {
    at: 36, by: "priya", text: "Kohli is anchoring, Axar is hitting. India 170+ from here",
    claim: { metric: "innings_runs", team: IND, op: "gte", value: 170, window: { type: "innings" }, basis: "total" },
    ifRight: "From 45/3 she said 170+. Receipts don't lie.", ifWrong: "The numbers let Priya down this once.",
  },
  {
    at: 88, by: "kabir", text: "Kohli is batting way too slow. He won't hit a single six today",
    claim: { metric: "batter_sixes", player: "V Kohli", op: "lte", value: 0, window: { type: "innings" }, basis: "total" },
    ifRight: "Not one six. Kabir saw it coming.", ifWrong: "That one landed in the stands, and on Kabir's call.",
  },
  {
    at: 120, by: "priya", text: "Last over. 10+ runs coming",
    claim: { metric: "innings_runs", team: IND, op: "gte", value: 10, window: { type: "over", over: 20 }, basis: "window" },
    ifRight: "Double figures in the last over, as ordered.", ifWrong: "So close. The last over had other plans.",
  },

  // ---- innings break ----
  {
    at: 127, by: "rahul", text: "176 kaafi nahi hai is pitch pe. SA jeetega 😩",
    claim: { metric: "match_winner", team: SA, op: "eq", value: 1, window: { type: "match" }, basis: "total" },
    ifRight: "Rahul called the heartbreak at the innings break.", ifWrong: "Innings break pe haar maan li thi. India ne nahi maani.",
  },
  {
    at: 127, by: "priya", text: "Bumrah gets 2 tonight. Minimum.",
    claim: { metric: "bowler_wickets", player: "JJ Bumrah", op: "gte", value: 2, window: { type: "innings" }, basis: "total" },
    ifRight: "Boom, twice. Priya said minimum.", ifWrong: "Bumrah was tidy, but the wickets column disagrees.",
  },
  {
    at: 128, by: "kabir", text: "de Kock 50 today, book it",
    claim: { metric: "batter_runs", player: "Q de Kock", op: "gte", value: 50, window: { type: "innings" }, basis: "total" },
    ifRight: "Booked and delivered.", ifWrong: "Booking cancelled. No refunds.",
  },

  // ---- South Africa chase ----
  {
    at: 139, by: "rahul", text: "Arshdeep wicket this over!! feel aa raha hai",
    claim: { metric: "bowler_wickets", player: "Arshdeep Singh", op: "gte", value: 1, window: { type: "over", over: 3 }, basis: "window" },
    ifRight: "Feel sahi tha. Rahul ne bola tha!", ifWrong: "Feel aaya, wicket nahi aaya.",
  },
  {
    at: 163, by: "kabir", text: "SA 100 by 12 overs, easy",
    claim: { metric: "innings_runs", team: SA, op: "gte", value: 100, window: { type: "by_over", over: 12 }, basis: "total" },
    ifRight: "Hundred up on schedule. Kabir called it.", ifWrong: "'Easy' is doing a lot of work in that sentence.",
  },
  {
    at: 181, by: "priya", text: "Klaasen is the danger man. He hits 3+ sixes tonight",
    claim: { metric: "batter_sixes", player: "H Klaasen", op: "gte", value: 3, window: { type: "innings" }, basis: "total" },
    ifRight: "Three into the crowd. Priya saw it coming.", ifWrong: "Klaasen kept it along the ground, for once.",
  },
  { at: 200, by: "rahul", text: "76 off 48, Klaasen set hai. Yeh match gaya haath se 😭" },
  {
    at: 201, by: "kabir", text: "QdK is set. He bats till the end and finishes it",
    claim: { metric: "batter_out", player: "Q de Kock", op: "eq", value: 0, window: { type: "innings" }, basis: "window" },
    ifRight: "Unbeaten, just like Kabir promised.", ifWrong: "Till the end? That was quick.",
  },
  {
    at: 206, by: "priya", text: "Miller hits a six this over",
    claim: { metric: "batter_sixes", player: "DA Miller", op: "gte", value: 1, window: { type: "over", over: 14 }, basis: "window" },
    ifRight: "Miller, over the rope. Priya called it.", ifWrong: "Miller kept it down. Not this over.",
  },
  {
    at: 212, by: "rahul", text: "Axar ko do. Wicket milega is over mein",
    claim: { metric: "innings_wickets", team: SA, op: "gte", value: 1, window: { type: "over", over: 15 }, basis: "window" },
    ifRight: "Axar ne dilaya. Rahul ne bola tha!", ifWrong: "Wicket nahi mila. Runs mil gaye, bahut saare.",
  },
  {
    at: 212, by: "kabir", text: "Klaasen 50 before this over ends",
    claim: { metric: "batter_runs", player: "H Klaasen", op: "gte", value: 50, window: { type: "by_over", over: 15 }, basis: "total" },
    ifRight: "Fifty inside the over. Ridiculous, and called.", ifWrong: "So close you could touch it. Still a miss.",
  },
  { at: 220, by: "rahul", text: "30 off 30. TV band kar raha hoon 😭" },
  {
    at: 220, by: "priya", text: "Not done yet. Bumrah's over: 5 runs or fewer",
    claim: { metric: "bowler_runs_conceded", player: "JJ Bumrah", op: "lte", value: 5, window: { type: "over", over: 16 }, basis: "window" },
    ifRight: "Bumrah squeezed. Priya called the squeeze.", ifWrong: "Even Bumrah leaked a few this time.",
  },
  {
    at: 226, by: "kabir", text: "Hardik to Klaasen? Six first ball",
    claim: { metric: "innings_sixes", team: SA, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" },
    ifRight: "First ball, into orbit. Kabir is unbearable now.", ifWrong: "Six first ball? Third umpire has checked. Not even close.",
  },
  {
    at: 227, by: "rahul", text: "KLAASEN GAYAAA!!! Ab India jeetega 🔥🔥",
    claim: { metric: "match_winner", team: IND, op: "eq", value: 1, window: { type: "match" }, basis: "total" },
    ifRight: "Rahul ne dono side bola tha. Yeh wala sahi nikla.", ifWrong: "Umeed jagi thi. Bas jagi hi reh gayi.",
  },
  {
    at: 232, by: "priya", text: "Bumrah wicket this over. Calling it.",
    claim: { metric: "bowler_wickets", player: "JJ Bumrah", op: "gte", value: 1, window: { type: "over", over: 18 }, basis: "window" },
    ifRight: "Stumps flying. Priya called it.", ifWrong: "Bumrah bowled well, the batters survived.",
  },
  {
    at: 238, by: "kabir", text: "Miller is still there. He stays not out and wins it",
    claim: { metric: "batter_out", player: "DA Miller", op: "eq", value: 0, window: { type: "innings" }, basis: "window" },
    ifRight: "Killer Miller, unbeaten. Kabir knew.", ifWrong: "Not out? Ask the man on the boundary rope.",
  },
  {
    at: 244, by: "rahul", text: "16 off 6. Hardik. Wicket first ball please 🙏🙏",
    claim: { metric: "innings_wickets", team: SA, op: "gte", value: 1, window: { type: "balls", balls: 1 }, basis: "window" },
    ifRight: "PEHLI BALL PE! Rahul ne bola tha!!", ifWrong: "Dua qubool nahi hui.",
  },
  { at: 251, by: "priya", text: "What a final. Check the board 👀" },
];

// ---- unscripted reactions, so the chat feels alive between calls ----

type Mood = "six" | "four" | "wicket";
const REACTIONS: Record<FriendId, Record<Mood, { good: string[]; bad: string[] }>> = {
  rahul: {
    six: { good: ["KYA MAARA HAI 🔥", "stadium ke bahar!!"], bad: ["nahi yaar 😩", "bowling kya ho rahi hai"] },
    four: { good: ["shot!", "chalo chalo"], bad: ["uff", "field kahan hai"] },
    wicket: { good: ["OUT!!! 🔥🔥", "YESSS", "gaya gaya gaya"], bad: ["nahiii 😭", "bas, ho gaya"] },
  },
  priya: {
    six: { good: ["clean hit", "that changes the rate"], bad: ["that hurts the equation", "too full"] },
    four: { good: ["good placement"], bad: ["loose ball"] },
    wicket: { good: ["big wicket", "that's the one they needed"], bad: ["bad time to lose one", "collapse watch"] },
  },
  kabir: {
    six: { good: ["HUGE", "that's in the car park 🚗"], bad: ["HUGE", "ok that was massive"] },
    four: { good: ["four more"], bad: ["four more"] },
    wicket: { good: ["GONE!", "see ya 👋"], bad: ["GONE!", "game on now"] },
  },
};

/**
 * Maybe a one-line reaction to a ball. `roll` is a number in [0,1) supplied by
 * the room so the chat is the same on every replay. India fans cheer India.
 */
export function reactionFor(ball: Ball, battingTeam: string, roll: number): { by: FriendId; text: string } | null {
  const mood: Mood | null = ball.wicket ? "wicket" : ball.six ? "six" : ball.four ? "four" : null;
  if (!mood) return null;
  const chance = mood === "wicket" ? 0.8 : mood === "six" ? 0.5 : 0.12;
  if (roll > chance) return null;
  const pick = Math.floor((roll / chance) * 1000);
  const by = FRIENDS[pick % FRIENDS.length].id;
  // every demo friend is watching as an India supporter, Kabir just hides it
  const goodForIndia = mood === "wicket" ? battingTeam !== IND : battingTeam === IND;
  const lines = REACTIONS[by][mood][goodForIndia ? "good" : "bad"];
  return { by, text: lines[Math.floor(pick / FRIENDS.length) % lines.length] };
}
