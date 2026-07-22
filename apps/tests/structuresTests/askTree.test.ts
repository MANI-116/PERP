import { describe, expect, it } from "bun:test";
import { AskTree } from "@repo/engine-package";

describe("AskTree", () => {

    it("should add first price", () => {
        const tree = new AskTree();

        tree.addPrice(100n);

        expect(tree.getLength()).toBe(1);
        expect(tree.getMinAsk()).toBe(100n);
    });

    it("should maintain descending order", () => {
        const tree = new AskTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        expect(tree.getMinAsk()).toBe(90n);
        expect(tree.getLength()).toBe(3);
    });

    it("should ignore duplicate prices", () => {
        const tree = new AskTree();

        tree.addPrice(100n);
        tree.addPrice(100n);
        tree.addPrice(100n);

        expect(tree.getLength()).toBe(1);
    });

    it("should remove existing price", () => {
        const tree = new AskTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        tree.removePrice(100n);

        expect(tree.getLength()).toBe(2);
    });

    it("should remove minimum ask", () => {
        const tree = new AskTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        tree.removePrice(90n);

        expect(tree.getMinAsk()).toBe(100n);
    });

    it("should allow removing non existing price", () => {
        const tree = new AskTree();

        tree.addPrice(100n);

        expect(
            tree.removePrice(999n)
        ).toBeFalsy();
    });

    it("should pop lowest ask", () => {
        const tree = new AskTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        expect(tree.pop()).toBe(90n);
    });

    it("clone -> create should recover tree", () => {
        const tree = new AskTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);

        const snapshot = tree.clone();

        const recovered =
            AskTree.create(
                snapshot.map(BigInt)
            );

        expect(
            recovered.getLength()
        ).toBe(tree.getLength());

        expect(
            recovered.getMinAsk()
        ).toBe(tree.getMinAsk());
    });

    it("snapshot -> recover -> snapshot should be identical", () => {
        const tree = new AskTree();

        tree.addPrice(100n);
        tree.addPrice(120n);
        tree.addPrice(90n);
        tree.addPrice(150n);

        const snapshot1 = tree.clone();

        const recovered =
            AskTree.create(
                snapshot1.map(BigInt)
            );

        const snapshot2 =
            recovered.clone();

        expect(snapshot2)
            .toEqual(snapshot1);
    });

    it("should recover large dataset", () => {
        const tree = new AskTree();

        for(let i=0;i<1000;i++){
            tree.addPrice(BigInt(i));
        }

        const snapshot = tree.clone();

        const recovered =
            AskTree.create(
                snapshot.map(BigInt)
            );

        expect(
            recovered.getLength()
        ).toBe(1000);
    });

});