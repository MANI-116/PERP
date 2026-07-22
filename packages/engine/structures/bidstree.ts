export class BidTree {
  private prices: bigint[];
  constructor() {
    this.prices = [];
  }
  clone() {
    return this.prices.map((e) => e.toString());
  }

  static create(prices: bigint[]) {
    const bidTree = new BidTree();
    prices.forEach((p) => bidTree.prices.push(p));
    return bidTree;
  }

  findBelow(price: bigint) {
    return this.prices.filter((p) => {
      return p <= price;
    });
  }
  getBestBids(price:bigint):bigint[]{
    return this.prices.filter((bidPrice)=>bidPrice>=price);
  }

  getLength() {
    return this.prices.length;
  }


  removePrice(price: bigint) {
    const index = this.prices.findIndex(p => p === price);
    if (index > -1) {
      this.prices.splice(index, 1);
      return true;
    }
    return false;
  }

  addPrice(price: bigint): boolean {
    if (this.prices.includes(price)) {
      return true;
    }
    this.prices.push(price);
    this.prices.sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });
    return true;
  }

  getTop() {
    return this.prices[this.prices.length - 1];
  }

  pop() {
    return this.prices.pop();
  }
}
