// Farm-plan generator for the token radar.
//
// A farm plan is six concrete steps for one pre-token protocol. Every step
// names the protocol, its main chain and its category's core action, so a
// plan for a lending market reads nothing like a plan for a DEX. Amounts
// scale with the protocol's size: bigger TVL, bigger suggested ticket.
// Steps carry a rough cost and time so a reader can judge the effort.
//
// Nothing here is copied from any starter: the categories, the verbs and
// the step shapes are written for this board.

export interface FarmInput {
  name: string;
  slug: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
}

interface CategoryPlay {
  // What the product fundamentally is, in one clause.
  product: string;
  // The first qualifying action a farmer takes.
  firstAction: string;
  // The action repeated every week.
  weeklyAction: string;
  // A second surface of the same protocol worth touching.
  secondSurface: string;
}

const PLAYS: Record<string, CategoryPlay> = {
  Lending: {
    product: "a lending market where deposits earn yield and back borrows",
    firstAction: "supply a stablecoin or blue-chip asset as collateral",
    weeklyAction: "top up the supply or open a small borrow against it",
    secondSurface: "a second lending market or isolated pool on the same protocol",
  },
  Dexs: {
    product: "a decentralised exchange with spot swaps and liquidity pools",
    firstAction: "swap a small amount through its router, then add liquidity to its deepest pool",
    weeklyAction: "route one swap through the DEX instead of another venue",
    secondSurface: "a second pool or a concentrated-liquidity position",
  },
  Yield: {
    product: "a yield product that puts deposits to work in vaults",
    firstAction: "deposit into its highest-TVL vault and hold the receipt token",
    weeklyAction: "harvest the vault yield and re-deposit it",
    secondSurface: "a second vault with a different strategy",
  },
  RWA: {
    product: "a real-world-asset platform with tokenised off-chain yield",
    firstAction: "buy into its flagship tokenised asset position",
    weeklyAction: "check the asset's yield accrual and keep the position funded",
    secondSurface: "a second tokenised asset or maturity on the platform",
  },
  Derivatives: {
    product: "a derivatives venue for perpetuals and leveraged positions",
    firstAction: "open a small perpetual position with isolated margin",
    weeklyAction: "open or close one position, keeping size modest and margin isolated",
    secondSurface: "a second market or a hedge position on the same venue",
  },
  "Risk Curators": {
    product: "a curator platform where vaults allocate capital across strategies",
    firstAction: "deposit into a curator vault with a published allocation strategy",
    weeklyAction: "review the vault's allocation report and keep the deposit in place",
    secondSurface: "a second curator vault with a different risk profile",
  },
  "Onchain Capital Allocator": {
    product: "an on-chain allocator that routes capital into strategies",
    firstAction: "allocate into its flagship strategy",
    weeklyAction: "review the strategy's performance and rebalance if it drifted",
    secondSurface: "a second strategy run by the same allocator",
  },
  "Liquidity Manager": {
    product: "a liquidity manager that runs concentrated positions for depositors",
    firstAction: "deposit into its managed liquidity position",
    weeklyAction: "check the position's range and let the manager rebalance it",
    secondSurface: "a second managed pool on another pair",
  },
  "Yield Aggregator": {
    product: "a yield aggregator that compounds deposits across farms",
    firstAction: "deposit into its main compounding vault",
    weeklyAction: "claim the aggregator's rewards and compound them back in",
    secondSurface: "a second vault compounding a different farm",
  },
  "Leveraged Farming": {
    product: "a leveraged farming product that borrows to amplify LP yield",
    firstAction: "open a small leveraged farming position at a conservative leverage",
    weeklyAction: "check the position's health factor and top up collateral if it slipped",
    secondSurface: "a second leveraged pair with a different asset",
  },
  CDP: {
    product: "a collateralised-debt platform that mints a stable asset against deposits",
    firstAction: "lock collateral and mint a modest amount of its stable asset",
    weeklyAction: "check the collateral ratio and keep it comfortably above liquidation",
    secondSurface: "a second collateral type in a separate vault",
  },
  "Basis Trading": {
    product: "a basis-trading venue that earns the funding-rate spread",
    firstAction: "enter a small delta-neutral basis position",
    weeklyAction: "check the funding rate and roll the position when it expires",
    secondSurface: "a second basis pair on the same venue",
  },
  "Anchor BTC": {
    product: "a BTC-anchored product that puts bitcoin to work on-chain",
    firstAction: "deposit BTC into its anchor vault",
    weeklyAction: "verify the BTC backing and keep the deposit staked",
    secondSurface: "a second BTC vault or a restaking option it offers",
  },
  "Staking Pool": {
    product: "a staking pool that delegates deposits to validators",
    firstAction: "stake into the pool and hold its liquid receipt token",
    weeklyAction: "restake the staking rewards the pool pays out",
    secondSurface: "a second staking pool or validator set it runs",
  },
  Farm: {
    product: "a farm that rewards liquidity providers with emissions",
    firstAction: "deposit LP tokens into its main farm",
    weeklyAction: "harvest the farm's rewards and re-stake them",
    secondSurface: "a second farm pool on the same platform",
  },
};

const DEFAULT_PLAY: CategoryPlay = {
  product: "an on-chain protocol with a live product and real users",
  firstAction: "use its core product once end to end",
  weeklyAction: "use its core product again for a real need",
  secondSurface: "a second feature of the same protocol",
};

// Suggested ticket scales with size: a $2B protocol's farmer is expected
// to show up with more than a $6M protocol's. Kept modest throughout.
function ticket(tvlUsd: number): number {
  if (tvlUsd >= 500_000_000) return 250;
  if (tvlUsd >= 100_000_000) return 150;
  return 100;
}

function money(n: number): string {
  return `$${n}`;
}

function mainChain(p: FarmInput): string {
  return p.chains.length > 0 ? p.chains[0] : "its main chain";
}

function otherChain(p: FarmInput): string | null {
  return p.chains.length > 1 ? p.chains[1] : null;
}

// Build the six steps for one protocol. Each step is a full sentence of
// 20-600 characters, naming the protocol and its chains, with a cost and
// a time estimate so the reader can size the work.
export function farmPlan(p: FarmInput): string[] {
  const play = PLAYS[p.category ?? ""] ?? DEFAULT_PLAY;
  const chain = mainChain(p);
  const second = otherChain(p);
  const amount = ticket(p.tvlUsd);
  const name = p.name;

  const setup =
    `Set up a fresh wallet that holds only the funds you plan to farm with, ` +
    `fund it on ${chain}, and open ${name} (${play.product}) from its official site. ` +
    `Cost: under $3 of gas for the first transaction. Time: 5 minutes.`;

  const first =
    `On ${chain}, ${play.firstAction} with about ${money(amount)} and keep the position open. ` +
    `This is the qualifying action: a real deposit through ${name}'s own contracts, not a test transfer. ` +
    `Cost: ${money(amount)} of capital and a few dollars of gas. Time: 15 minutes to set up.`;

  const weekly =
    `Once a week, ${play.weeklyAction}. ` +
    `Airdrop snapshots reward steady activity over one-off deposits, so a small weekly action beats a single large one. ` +
    `Cost: a few dollars of gas a week. Time: 10 minutes a week.`;

  const breadth = second
    ? `Use ${play.secondSurface} on ${second} as well, so your activity spans more than one chain. ` +
      `Multi-chain users show up in more snapshots than single-chain ones. ` +
      `Cost: about ${money(Math.round(amount / 2))} of capital and a few dollars of gas. Time: 15 minutes.`
    : `Use ${play.secondSurface} too, so your activity spans more than one part of the product. ` +
      `Users who touch two surfaces show up in more snapshots than one-feature users. ` +
      `Cost: about ${money(Math.round(amount / 2))} of capital and a few dollars of gas. Time: 15 minutes.`;

  const points =
    `Check whether ${name} runs a points program, quests page or community roles, and opt in if it does. ` +
    `If there is no program yet, join its official community channels so you hear about one first. ` +
    `Cost: nothing but attention. Time: 10 minutes.`;

  const hold =
    `Hold the position for at least 30 days and keep one wallet doing the farming. ` +
    `Do not split the same activity across many wallets: that reads as Sybil behaviour and snapshots filter it out. ` +
    `Watch ${name}'s official announcements for a token or claim date, and claim from its official site only. ` +
    `Cost: nothing extra. Time: 5 minutes a week to check in.`;

  return [setup, first, weekly, breadth, points, hold];
}
