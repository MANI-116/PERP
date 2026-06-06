import { Order } from "@repo/engine-package";

const order = new Order(
    "order-1",
    "ravi",
    "sol",
    20n,
    "LONG",
    100n,
    2n,
    "LIMIT"
);

order.filled = 5n;
order.status = "OPEN";

const snapshot = order.giveSnapshot();

console.log("snapshot");
console.log(snapshot);

const recovered =
    Order.createFromSnapshot(
        JSON.parse(snapshot).orderSnapshotString
    );

console.log("recovered");
console.log(recovered);


if (!recovered) {
    throw new Error("recovery failed");
}

console.log(
    recovered.orderId === order.orderId,
    recovered.userId === order.userId,
    recovered.assetId === order.assetId,
    recovered.qty === order.qty,
    recovered.side === order.side,
    recovered.price === order.price,
    recovered.leverage === order.leverage,
    recovered.type === order.type,
    recovered.status === order.status,
    recovered.filled === order.filled,
    recovered.initialMargin === order.initialMargin,
    recovered.maintenanceMargin === order.maintenanceMargin
);

console.log("order snapshot test passed");

const badSnapshot = JSON.stringify({
    orderId:"bad",
    qty:"20",
    price:"100"
});

const badRecovered =
    Order.createFromSnapshot(badSnapshot);

console.log(badRecovered);