import { describe, expect, it } from "bun:test";
import { BidTree } from "@repo/engine-package";

describe("BidTree", () => {

    it("should add first price", () => {
        const tree = new BidTree();

        tree.addPrice(100n);

        expect(tree.getLength()).toBe(1);
        expect(tree.getTop()).toBe(100n);
    });

    it("should maintain ascending order", () => {
        const tree = new BidTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        expect(tree.getTop()).toBe(120n);
        expect(tree.getLength()).toBe(3);
    });

    it("should ignore duplicate prices", () => {
        const tree = new BidTree();

        tree.addPrice(100n);
        tree.addPrice(100n);
        tree.addPrice(100n);

        expect(tree.getLength()).toBe(1);
    });

    it("should remove existing price", () => {
        const tree = new BidTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        tree.removePrice(100n);

        expect(tree.getLength()).toBe(2);
    });

    it("should remove highest bid", () => {
        const tree = new BidTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        tree.removePrice(120n);

        expect(tree.getTop()).toBe(100n);
    });

    it("should allow removing non existing price", () => {
        const tree = new BidTree();

        tree.addPrice(100n);

        expect(
            tree.removePrice(999n)
        ).toBeFalsy();
    });

    it("should pop highest bid", () => {
        const tree = new BidTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        expect(tree.pop()).toBe(120n);
    });

    it("clone -> create should recover tree", () => {
        const tree = new BidTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        const snapshot = tree.clone();

        const recovered =
            BidTree.create(snapshot.map((e)=>BigInt(e)));

        expect(
            recovered.getLength()
        ).toBe(tree.getLength());

        expect(
            recovered.getTop()
        ).toBe(tree.getTop());
    });

    it("snapshot -> recover -> snapshot should be identical", () => {
        const tree = new BidTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);
        tree.addPrice(150n);

        const snapshot1 = tree.clone();

        const recovered =
            BidTree.create(snapshot1.map((e)=>BigInt(e)));

        const snapshot2 =
            recovered.clone();

        expect(snapshot2)
            .toEqual(snapshot1);
    });

    it("should recover large dataset", () => {
        const tree = new BidTree();

        for(let i=0;i<1000;i++){
            tree.addPrice(BigInt(i));
        }

        const snapshot = tree.clone();

        const recovered =
            BidTree.create(snapshot.map((e)=>BigInt(e)));

        expect(
            recovered.getLength()
        ).toBe(1000);
    });

});