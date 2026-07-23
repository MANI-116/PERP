const fs = require('fs');
let path = 'packages/engine/structures/orderbook.ts';
let code = fs.readFileSync(path, 'utf8');

const oldMarketLoop = `
        //executing the order
        if (requiredQty <= availablleQty) {
          matchedOrder.filled += requiredQty;
          order.filled += requiredQty;
        } else {
          matchedOrder.filled += availablleQty;
          order.filled += availablleQty;
        }

        matchedOrders.push({
          price: matchedOrder.price,
          leverage: matchedOrder.leverage,
          side: matchedOrder.side,
          userId: matchedOrder.userId,
          orderId: matchedOrder.orderId,
          qtyTransfered: matchedOrder.filled,
          timestamp: Date.now().toString(),
          tax: 0n,
        });

        if (matchedOrder.filled === matchedOrder.qty) {
          //order is filled completely so the order is removed from the pricelevel
          matchedOrder.side === 'SHORT' ? this.removeAskOrder(matchedOrder) : this.removeBuyOrder(matchedOrder);
        }
        if (order.filled === order.qty) {
          let updates = {
            uid:this.updateId++,
            bids: matchedOrder.side === 'LONG' ? [[price.toString(), opSidelevelData.totalQty.toString()]] : [[]],
            asks: matchedOrder.side === 'SHORT' ? [[price.toString(), opSidelevelData.totalQty.toString()]] : [[]],
          };
          return {
            event: 'ORDER_FILLED' as const,
            payload: {
              type: order.type,
              qty: qty,
              state: 'FILLED',
              userId,
              side,
              marketId: order.assetId,
              orderId: order.orderId,
              filled: order.qty,
              price: order.price,
              matchedOrders,
              updates,
            },
          };
        }
        
        currentOrderNode = nextNode;
      }
      if (order.side === 'SHORT') {
        bids.push([price.toString(), opSidelevelData.totalQty.toString()]);
      } else {
        asks.push([price.toString(), opSidelevelData.totalQty.toString()]);
      }
`;

const newMarketLoop = `
        const filled = requiredQty <= availablleQty ? requiredQty : availablleQty;

        matchedOrder.filled += filled;
        opSidelevelData.totalQty -= filled;
        order.filled += filled;

        matchedOrders.push({
          price: matchedOrder.price,
          leverage: matchedOrder.leverage,
          side: matchedOrder.side,
          userId: matchedOrder.userId,
          orderId: matchedOrder.orderId,
          qtyTransfered: filled,
          timestamp: Date.now().toString(),
          tax: 0n,
        });

        if (matchedOrder.filled === matchedOrder.qty) {
          matchedOrder.side === 'SHORT' ? this.removeAskOrder(matchedOrder) : this.removeBuyOrder(matchedOrder);
        }
        
        if (order.filled === order.qty) {
          if (order.side === 'SHORT') {
            bids.push([level.toString(), opSidelevelData.totalQty.toString()]);
          } else {
            asks.push([level.toString(), opSidelevelData.totalQty.toString()]);
          }

          let updates = {
            uid:this.updateId++,
            bids,
            asks,
          };
          return {
            event: 'ORDER_FILLED' as const,
            payload: {
              type: order.type,
              qty: qty,
              state: 'FILLED',
              userId,
              side,
              marketId: order.assetId,
              orderId: order.orderId,
              filled: order.qty,
              price: order.price,
              matchedOrders,
              updates,
            },
          };
        }
        
        currentOrderNode = nextNode;
      }
      if (order.side === 'SHORT') {
        bids.push([level.toString(), opSidelevelData.totalQty.toString()]);
      } else {
        asks.push([level.toString(), opSidelevelData.totalQty.toString()]);
      }
`;

code = code.replace(oldMarketLoop, newMarketLoop);
fs.writeFileSync(path, code);
