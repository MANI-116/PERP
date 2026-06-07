import { describe, expect, it } from "bun:test";
import { Position } from "@repo/engine-package";

function createPosition() {
  return new Position(
    "user-1",
    10n,
    100n,
    "LONG",
    50n,
    100n,
    100n
  );
}

describe("Position Accounting Invariants", () => {
  it("should calculate exact weighted average price", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    // (100*10 + 120*10) / 20
    expect(position.avgPrice).toBe(110n);
  });

  it("should calculate exact margin after same side fill", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    // 100 + (120*10)/10
    expect(position.initialMargin).toBe(220n);
  });

  it("should preserve accounting after multiple same side fills", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    position.addFill(
      140n,
      10n,
      10n,
      "LONG"
    );

    expect(position.qty).toBe(30n);

    // (100*10 + 120*10 + 140*10)/30
    expect(position.avgPrice).toBe(120n);

    // 100 + 120 + 140
    expect(position.initialMargin).toBe(360n);
  });

  it("should reduce margin proportionally during partial reduction", () => {
    const position = createPosition();

    const beforeMargin = position.initialMargin;

    position.addFill(
      120n,
      5n,
      10n,
      "SHORT"
    );

    expect(position.qty).toBe(5n);

    expect(position.initialMargin)
      .toBe(beforeMargin / 2n);
  });

  it("should preserve margin per quantity after partial reduction", () => {
    const position = createPosition();

    const marginPerQtyBefore =
      position.initialMargin / position.qty;

    position.addFill(
      120n,
      4n,
      10n,
      "SHORT"
    );

    const marginPerQtyAfter =
      position.initialMargin / position.qty;

    expect(marginPerQtyAfter)
      .toBe(marginPerQtyBefore);
  });

  it("should recalculate margin correctly after reversal", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.side).toBe("SHORT");

    expect(position.qty).toBe(5n);

    // net qty = 5
    // margin = (5 * 120) / 10
    expect(position.initialMargin).toBe(60n);
  });

  it("should use fill price as avg price after reversal", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.avgPrice).toBe(120n);
  });

  it("should preserve quantity accounting after reversal", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.qty).toBe(5n);
  });

  it("should preserve side after same side fills", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    expect(position.side).toBe("LONG");
  });

  it("should recalculate liquidation price after same side fill", () => {
    const position = createPosition();

    const before =
      position.liquidationPrice;

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    expect(
      position.liquidationPrice
    ).not.toBe(before);
  });

  it("should preserve margin per quantity after partial reduction", () => {
  const position = createPosition();

  const beforeRatio =
    position.initialMargin / position.qty;

  position.addFill(
    120n,
    5n,
    10n,
    "SHORT"
  );

  const afterRatio =
    position.initialMargin / position.qty;

  expect(afterRatio).toBe(beforeRatio);
});

  it("should preserve position id after recovery", () => {
    const position = createPosition();

    const recovered =
      Position.createFromSnapshot(
        position.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(recovered!.id)
      .toBe(position.id);
  });

  it("should preserve margin exactly after recovery", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    const recovered =
      Position.createFromSnapshot(
        position.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.initialMargin
    ).toBe(position.initialMargin);
  });

  it("should preserve liquidation price exactly after recovery", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    const recovered =
      Position.createFromSnapshot(
        position.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.liquidationPrice
    ).toBe(position.liquidationPrice);
  });

  it("should preserve unrealized pnl exactly after recovery", () => {
    const position = new Position(
      "user-1",
      10n,
      100n,
      "LONG",
      50n,
      120n,
      100n
    );

    const recovered =
      Position.createFromSnapshot(
        position.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.unrealizedPnL
    ).toBe(position.unrealizedPnL);
  });
});

describe("Position invariants checks", () => {

  it("should initialize position correctly", () => {
    const position = createPosition();

    expect(position.userId).toBe("user-1");
    expect(position.qty).toBe(10n);
    expect(position.avgPrice).toBe(100n);
    expect(position.state).toBe("OPEN");
  });

  it("should calculate unrealized pnl for long position", () => {
    const position = new Position(
      "user-1",
      10n,
      100n,
      "LONG",
      50n,
      120n,
      100n
    );

    expect(position.unrealizedPnL).toBe(200n);
  });

  it("should calculate unrealized pnl for short position", () => {
    const position = new Position(
      "user-1",
      10n,
      100n,
      "SHORT",
      50n,
      120n,
      100n
    );

    expect(position.unrealizedPnL).toBe(-200n);
  });

  it("should increase position on same side fill", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    expect(position.qty).toBe(20n);
    expect(position.avgPrice).not.toBe(100n);
  });

  it("should increase margin on same side fill", () => {
    const position = createPosition();

    const beforeMargin =
      position.initialMargin;

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    expect(position.initialMargin)
      .toBeGreaterThan(beforeMargin);
  });

  it("should preserve quantity accounting on same side fill", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "LONG"
    );

    expect(position.qty).toBe(25n);
  });

  it("should reduce position on opposite side fill", () => {
    const position = createPosition();

    const previousAvgPrice =
      position.avgPrice;

    position.addFill(
      120n,
      5n,
      10n,
      "SHORT"
    );

    expect(position.qty).toBe(5n);

    expect(position.avgPrice)
      .toBe(previousAvgPrice);

    expect(position.state)
      .toBe("OPEN");
  });

  it("should preserve avg price during partial reduction", () => {
    const position = createPosition();

    const beforePrice =
      position.avgPrice;

    position.addFill(
      120n,
      5n,
      10n,
      "SHORT"
    );

    expect(position.avgPrice)
      .toBe(beforePrice);
  });

  it("should reduce quantity correctly", () => {
    const position = createPosition();

    position.addFill(
      120n,
      4n,
      10n,
      "SHORT"
    );

    expect(position.qty).toBe(6n);
  });

  it("should reverse position", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.side)
      .toBe("SHORT");

    expect(position.qty)
      .toBe(5n);

    expect(position.avgPrice)
      .toBe(120n);

    expect(position.state)
      .toBe("OPEN");
  });

  it("should flip side during reversal", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.side)
      .toBe("SHORT");
  });

  it("should preserve net quantity after reversal", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.qty)
      .toBe(5n);
  });

  it("should use fill price as avg price after reversal", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.avgPrice)
      .toBe(120n);
  });

  it("should close position", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "SHORT"
    );

    expect(position.state)
      .toBe("CLOSED");
  });

  it("should reduce margin", () => {
    const position = createPosition();

    const beforeMargin =
      position.initialMargin;

    position.reduceMargin(10n);

    expect(position.initialMargin)
      .toBe(beforeMargin - 10n);
  });

  it("should reject excessive margin reduction", () => {
    const position = createPosition();

    const response =
      position.reduceMargin(
        position.initialMargin + 1n
      );

    expect(response.success)
      .toBe(false);
  });

  it("should not mutate margin when reduction fails", () => {
    const position = createPosition();

    const beforeMargin =
      position.initialMargin;

    position.reduceMargin(
      beforeMargin + 1n
    );

    expect(position.initialMargin)
      .toBe(beforeMargin);
  });

  it("should preserve liquidation price after recovery", () => {
    const position = createPosition();

    const before =
      position.liquidationPrice;

    const recovered =
      Position.createFromSnapshot(
        position.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.liquidationPrice
    ).toBe(before);
  });

  it("should preserve unrealized pnl after recovery", () => {
    const position = new Position(
      "user-1",
      10n,
      100n,
      "LONG",
      50n,
      120n,
      100n
    );

    const before =
      position.unrealizedPnL;

    const recovered =
      Position.createFromSnapshot(
        position.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.unrealizedPnL
    ).toBe(before);
  });

  it("should recover position from snapshot", () => {
    const position = createPosition();

    const snapshot =
      position.giveSnapshot();

    const recovered =
      Position.createFromSnapshot(
        snapshot
      );

    expect(recovered).not.toBeNull();

    expect(recovered!.userId)
      .toBe(position.userId);

    expect(recovered!.qty)
      .toBe(position.qty);

    expect(recovered!.avgPrice)
      .toBe(position.avgPrice);

    expect(recovered!.state)
      .toBe(position.state);
  });

  it("should preserve core invariants after recovery", () => {
    const position = createPosition();

    const recovered =
      Position.createFromSnapshot(
        position.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(recovered!.qty)
      .toBe(position.qty);

    expect(recovered!.avgPrice)
      .toBe(position.avgPrice);

    expect(recovered!.initialMargin)
      .toBe(position.initialMargin);

    expect(recovered!.side)
      .toBe(position.side);

    expect(recovered!.state)
      .toBe(position.state);
  });

  it("snapshot -> recover -> snapshot should be identical", () => {
    const position = createPosition();

    const snapshot1 =
      position.giveSnapshot();

    const recovered =
      Position.createFromSnapshot(
        snapshot1
      );

    expect(recovered).not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot();

    expect(snapshot2)
      .toEqual(snapshot1);
  });

  it("should reject corrupted snapshot", () => {
    const recovered =
      Position.createFromSnapshot(
        '{"bad":"data"}'
      );

    expect(recovered)
      .toBeNull();
  });

});

describe("Position", () => {

  it("should initialize position correctly", () => {
    const position = createPosition();

    expect(position.userId).toBe("user-1");
    expect(position.qty).toBe(10n);
    expect(position.avgPrice).toBe(100n);
    expect(position.state).toBe("OPEN");
  });

  it("should calculate unrealized pnl", () => {
    const position = new Position(
      "user-1",
      10n,
      100n,
      "LONG",
      50n,
      120n,
      100n
    );

    expect(position.unrealizedPnL).toBe(200n);
  });

  it("should increase position on same side fill", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "LONG"
    );

    expect(position.qty).toBe(20n);
    expect(position.avgPrice).not.toBe(100n);
  });

  it("should reduce position on opposite side fill", () => {
    const position = createPosition();

    const previousAvgPrice =
      position.avgPrice;

    position.addFill(
      120n,
      5n,
      10n,
      "SHORT"
    );

    expect(position.qty).toBe(5n);

    expect(position.avgPrice)
      .toBe(previousAvgPrice);

    expect(position.state)
      .toBe("OPEN");
  });

  it("should reverse position", () => {
    const position = createPosition();

    position.addFill(
      120n,
      15n,
      10n,
      "SHORT"
    );

    expect(position.side)
      .toBe("SHORT");

    expect(position.qty)
      .toBe(5n);

    expect(position.avgPrice)
      .toBe(120n);

    expect(position.state)
      .toBe("OPEN");
  });

  it("should close position", () => {
    const position = createPosition();

    position.addFill(
      120n,
      10n,
      10n,
      "SHORT"
    );

    expect(position.state)
      .toBe("CLOSED");
  });

  it("should reduce margin", () => {
    const position = createPosition();

    const margin =
      position.initialMargin;

    position.reduceMargin(10n);

    expect(position.initialMargin)
      .toBe(margin - 10n);
  });

  it("should reject excessive margin reduction", () => {
    const position = createPosition();

    const response =
      position.reduceMargin(
        position.initialMargin + 1n
      );

    expect(response.success)
      .toBe(false);
  });

  it("should recover position from snapshot", () => {
    const position = createPosition();

    const snapshot =
      position.giveSnapshot();

    const recovered =
      Position.createFromSnapshot(
        snapshot
      );

    expect(recovered).not.toBeNull();

    expect(recovered!.userId)
      .toBe(position.userId);

    expect(recovered!.qty)
      .toBe(position.qty);

    expect(recovered!.avgPrice)
      .toBe(position.avgPrice);

    expect(recovered!.state)
      .toBe(position.state);
  });

  it("snapshot -> recover -> snapshot should be identical", () => {
    const position = createPosition();

    const snapshot1 =
      position.giveSnapshot();

    const recovered =
      Position.createFromSnapshot(
        snapshot1
      );

    expect(recovered).not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot();

    expect(snapshot2)
      .toEqual(snapshot1);
  });

  it("should reject corrupted snapshot", () => {
    const recovered =
      Position.createFromSnapshot(
        '{"bad":"data"}'
      );

    expect(recovered)
      .toBeNull();
  });

});