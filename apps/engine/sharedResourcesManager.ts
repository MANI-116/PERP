export let EXCHANGE_BALANCE = 1000n;

export function incrementExchangeBalance(amount: bigint) {
  EXCHANGE_BALANCE += amount;
}

export function decrementExchangeBalance(amount: bigint) {
  EXCHANGE_BALANCE -= amount;
}
