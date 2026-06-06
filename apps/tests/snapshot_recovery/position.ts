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