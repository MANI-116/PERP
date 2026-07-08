import { describe, expect, it } from "bun:test";
import { User, UserManager } from "@repo/engine-package";

function createUser(userId = "user-1") {
  return new User(userId);
}

describe("UserManager", () => {

  it("should add user", () => {
    const manager = UserManager.create();

    const res = manager.addUser(
      createUser()
    );

    expect(res.success).toBe(true);
  });

  it("should reject duplicate user", () => {
    const manager = UserManager.create();

    manager.addUser(
      createUser("duplicate")
    );

    const res = manager.addUser(
      createUser("duplicate")
    );

    expect(res.success).toBe(false);
  });

  it("should credit user balance", () => {
    const manager = UserManager.create();

    const user = createUser("credit-user");

    manager.addUser(user);

    const res =
      manager.rampUser(
        "credit-user",
        1000n
      );

    expect(res.success).toBe(true);

    expect(
      user.collateral.available
    ).toBe(1000n);
  });

  it("should lock balance", () => {
    const manager = UserManager.create();

    const user = createUser("lock-user");

    manager.addUser(user);

    manager.rampUser(
      "lock-user",
      1000n
    );

    const success =
      manager.lockAmount(
        "lock-user",
        500n
      );

    expect(success).toBe(true);

    expect(
      user.collateral.available
    ).toBe(500n);

    expect(
      user.collateral.locked
    ).toBe(500n);
  });

  it("should reject lock exceeding balance", () => {
    const manager = UserManager.create();

    const user = createUser("poor-user");

    manager.addUser(user);

    manager.rampUser(
      "poor-user",
      100n
    );

    const success =
      manager.lockAmount(
        "poor-user",
        1000n
      );

    expect(success).toBe(false);
  });

  it("should debit locked amount", () => {
    const manager = UserManager.create();

    const user = createUser("debit-user");

    manager.addUser(user);

    manager.rampUser(
      "debit-user",
      1000n
    );

    manager.lockAmount(
      "debit-user",
      600n
    );

    const res =
      manager.debitLockAmount(
        "debit-user",
        200n
      );

    expect(res.success).toBe(true);

    expect(
      user.collateral.locked
    ).toBe(400n);
  });

  it("should reject debit exceeding locked amount", () => {
    const manager = UserManager.create();

    const user = createUser("locked-user");

    manager.addUser(user);

    const res =
      manager.debitLockAmount(
        "locked-user",
        100n
      );

    expect(res.success).toBe(false);
  });

  it("should add and retrieve position", () => {
    const manager = UserManager.create();

    const user = createUser("position-user");

    manager.addUser(user);

    manager.addPosition(
      "position-user",
      "btc-usdt",
      "position-1"
    );

    const res =
      manager.getPosition(
        "position-user",
        "btc-usdt"
      );

    expect(res.success).toBe(true);

    if (res.success) {
      expect(
        res.positionId
      ).toBe("position-1");
    }
  });

  it("should return error for unknown position", () => {
    const manager = UserManager.create();

    const user = createUser("empty-user");

    manager.addUser(user);

    const res =
      manager.getPosition(
        "empty-user",
        "btc-usdt"
      );

    expect(res.success).toBe(false);
  });

});

describe("User Snapshot Recovery", () => {

  it("should recover user id", () => {
    const user = createUser("snapshot-user");

    const recovered =
      User.createFromSnapshot(
        user.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.userId
    ).toBe(user.userId);
  });

  it("should preserve collateral after recovery", () => {
    const user = createUser("money-user");

    user.collateral.available = 1000n;
    user.collateral.locked = 200n;

    const recovered =
      User.createFromSnapshot(
        user.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.collateral.available
    ).toBe(1000n);

    expect(
      recovered!.collateral.locked
    ).toBe(200n);
  });

  it("should preserve positions after recovery", () => {
    const user = createUser("position-snapshot");

    user.positions.set(
      "btc-usdt",
      "position-1"
    );

    const recovered =
      User.createFromSnapshot(
        user.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.positions.get(
        "btc-usdt"
      )
    ).toBe("position-1");
  });

  it("snapshot recover snapshot should be identical", () => {
    const user = createUser("roundtrip");

    user.collateral.available = 500n;
    user.collateral.locked = 100n;

    user.positions.set(
      "btc-usdt",
      "position-1"
    );

    const snapshot1 =
      user.giveSnapshot();

    const recovered =
      User.createFromSnapshot(
        snapshot1
      );

    expect(recovered).not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot();

    expect(snapshot2)
      .toEqual(snapshot1);
  });

});

describe("UserManager Snapshot Recovery", () => {

  it("should recover empty manager", () => {
    const manager = UserManager.create();

    const recovered =
      UserManager.createFromSnapshot(
        manager.giveSnapshot()
      );

    expect(recovered).not.toBeNull();
  });

  it("should recover single user", () => {
    const manager = UserManager.create();

    const user =
      createUser("recover-user");

    manager.addUser(user);

    const recovered =
      UserManager.createFromSnapshot(
        manager.giveSnapshot()
      );

    expect(recovered).not.toBeNull();

    expect(
      recovered!.foundUser(
        "recover-user"
      )
    ).toBe(true);
  });

  it("snapshot recover snapshot should be identical", () => {
    const manager = UserManager.create();

    const user =
      createUser("roundtrip-user");

    user.collateral.available = 1000n;

    manager.addUser(user);

    const snapshot1 =
      manager.giveSnapshot();

    const recovered =
      UserManager.createFromSnapshot(
        snapshot1
      );

    expect(recovered).not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot();

    expect(snapshot2)
      .toEqual(snapshot1);
  });

});