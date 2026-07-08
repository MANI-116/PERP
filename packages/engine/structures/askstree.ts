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
  getLength() {
    return this.prices.length;
  }
  private findPosition(price: bigint, start: number, end: number): number {
    if (start > end || start >= this.prices.length || end >= this.prices.length || start < 0 || end < 0) {
      return -1;
    }
    if (start === end) {
      if (price < this.prices[start]!) {
        return start + 1;
      } else if (price > this.prices[start]!) {
        return start - 1;
      } else {
        return start;
      }
    }

    const middle = Math.floor(start + (end - start) / 2);

    if (price < this.prices[middle]!) {
      return this.findPosition(price, middle + 1, end);
    } else if (price > this.prices[middle]!) {
      return this.findPosition(price, start, middle - 1);
    }
    return middle;
  }
  private shift(start: number, end: number): { success?: boolean; message: string } {
    if (end + 1 >= this.prices.length) {
      return { success: false, message: 'end is out of bound' };
    }
    for (let current = end; current >= start; current--) {
      this.prices[current + 1] = this.prices[current]!;
    }

    return { success: true, message: 'shifted succesfully' };
  }
  addPrice(price: bigint): boolean {
    //when array is empty length is 0
    if (this.prices.length === 0) {
      this.prices.push(price);
      return true;
    }
    const index = this.findPosition(price, 0, this.prices.length - 1);

    if (index === -1) {
      //insert at start
      this.prices.push(price);
      const res = this.shift(0, this.prices.length - 2);
      if (!res.success) {
        console.log('error while shifting--', res.message);
        return false;
      }
      this.prices[0] = price;
      return true;
    }

    if (index === this.prices.length) {
      //insert at the end:
      this.prices.push(price);
      return true;
    }
    //already found
    if (this.prices[index] === price) {
      return true;
    }
    //shifting needed
    //make space for the new element

    const res = this.shift(index, this.prices.length - 1);
    if (!res.success) {
      console.log('error while shifting--', res.message);
      return false;
    }
    this.prices[index] = price;
    return true;
  }

  removePrice(price: bigint) {
    const position = this.findPosition(price, 0, this.prices.length - 1);
    if (position < 0 || position >= this.prices.length) return true;
    if (this.prices[position] === price) {
      //remove the price
      if (position === this.prices.length - 1) {
        this.prices.pop();
        return true;
      }
      for (let index = position; index < this.prices.length; index++) {
        this.prices[index] = this.prices[index + 1]!;
      }
      this.prices.pop();
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
