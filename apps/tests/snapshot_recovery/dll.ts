// dll.snapshot.test.ts

import { describe, it, expect } from "bun:test";

import { Dll, Node } from "@repo/engine-package";
import { Order } from "@repo/engine-package";

function createOrder(id: string) {
  return new Order(
    id,
    "user-1",
    "btc-usdt",
    10n,
    "LONG",
    100n,
    10n,
    "LIMIT"
  );
}

describe("DLL Snapshot Recovery", () => {
  it("should recover a single node dll", () => {
    const order = createOrder("1");

    const dll = new Dll(
      new Node(order)
    );

    const snapshot = dll.giveSnapshot();

    const recovered = Dll.createFromSnapshot(
      snapshot,
      Order.createFromSnapshot
    );

    expect(recovered).not.toBeNull();

    expect(recovered!.length).toBe(1);

    expect(recovered!.giveSnapshot()).toEqual(snapshot);
  });

  it("should recover multiple orders preserving FIFO order", () => {
    const o1 = createOrder("1");
    const o2 = createOrder("2");
    const o3 = createOrder("3");

    const dll = new Dll(
      new Node(o1)
    );

    dll.addNode(new Node(o2));
    dll.addNode(new Node(o3));

    const snapshot = dll.giveSnapshot();

    const recovered = Dll.createFromSnapshot(
      snapshot,
      Order.createFromSnapshot
    );

    expect(recovered).not.toBeNull();

    expect(recovered!.length).toBe(3);

    expect(
      recovered!.giveSnapshot()
    ).toEqual(snapshot);
  });

  it("snapshot -> recover -> snapshot should be identical", () => {
    const dll = new Dll(
      new Node(createOrder("1"))
    );

    dll.addNode(
      new Node(createOrder("2"))
    );

    dll.addNode(
      new Node(createOrder("3"))
    );

    dll.addNode(
      new Node(createOrder("4"))
    );

    const snapshot1 = dll.giveSnapshot();

    const recovered = Dll.createFromSnapshot(
      snapshot1,
      Order.createFromSnapshot
    );

    expect(recovered).not.toBeNull();

    const snapshot2 =
      recovered!.giveSnapshot();

    expect(snapshot2).toEqual(snapshot1);
  });

  it("recovered dll should allow addNode", () => {
    const dll = new Dll(
      new Node(createOrder("1"))
    );

    dll.addNode(
      new Node(createOrder("2"))
    );

    const recovered = Dll.createFromSnapshot(
      dll.giveSnapshot(),
      Order.createFromSnapshot
    );

    expect(recovered).not.toBeNull();

    recovered!.addNode(
      new Node(createOrder("3"))
    );

    expect(recovered!.length).toBe(3);
  });

  it("should remove recovered tail correctly", () => {
    const dll = new Dll(
      new Node(createOrder("1"))
    );

    const secondNode = new Node(
      createOrder("2")
    );

    dll.addNode(secondNode);

    const recovered = Dll.createFromSnapshot(
      dll.giveSnapshot(),
      Order.createFromSnapshot
    );

    expect(recovered).not.toBeNull();

    const head = recovered!.getFirstOrder();
    const tail = head.right!;

    const result =
      recovered!.removeNode(tail);

    expect(result.success).toBe(true);

    expect(recovered!.length).toBe(1);
  });

  it("should remove recovered head correctly", () => {
    const dll = new Dll(
      new Node(createOrder("1"))
    );

    dll.addNode(
      new Node(createOrder("2"))
    );

    const recovered = Dll.createFromSnapshot(
      dll.giveSnapshot(),
      Order.createFromSnapshot
    );

    expect(recovered).not.toBeNull();

    const head =
      recovered!.getFirstOrder();

    const result =
      recovered!.removeNode(head);

    expect(result.success).toBe(true);

    expect(recovered!.length).toBe(1);
  });

  it("should reject corrupted dll snapshot", () => {
    const recovered =
      Dll.createFromSnapshot(
        '{"bad":"data"}',
        Order.createFromSnapshot
      );

    expect(recovered).toBeNull();
  });

  it("should reject corrupted order snapshot", () => {
    const badSnapshot = JSON.stringify({
      snapshots: [
        JSON.stringify({
          bad: "data"
        })
      ]
    });

    const recovered =
      Dll.createFromSnapshot(
        badSnapshot,
        Order.createFromSnapshot
      );

    expect(recovered).toBeNull();
  });
});