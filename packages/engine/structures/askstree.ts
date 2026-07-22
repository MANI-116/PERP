export class AskTree {
  private prices: bigint[];
  constructor() {
    this.prices = [];
  }

  clone() {
    return this.prices.map((e) => e.toString());
  }

  static create(prices: bigint[]) {
    const askTree = new AskTree();
    prices.forEach((p) => askTree.prices.push(p));
    return askTree;
  }
  findAbove(price: bigint) {
    return this.prices.filter((p) => {
      return p >= price;
    });
  }
  getBestAsks(price:bigint):bigint[]{
    return this.prices.filter((askPrice)=> askPrice <= price);

  }
  getLength() {
    return this.prices.length;
  }

  addPrice(price: bigint): boolean {
    if (this.prices.includes(price)) {
      return true;
    }
    this.prices.push(price);
    this.prices.sort((a, b) => {
        if (b < a) return -1;
        if (b > a) return 1;
        return 0;
    });
    return true;
  }

  removePrice(price: bigint) {
    const index = this.prices.findIndex(p => p === price);
    if (index > -1) {
      this.prices.splice(index, 1);
      return true;
    }
    return false;
  }

  getMinAsk() {
    return this.prices[this.prices.length - 1];
  }
  pop() {
    return this.prices.pop();
  }
}
