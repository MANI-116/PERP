export interface Transaction{
  qty:bigint 
  price:bigint
  takerId: string       
  makerId: string       
  takerFee:bigint
  makerFee :bigint
  orderId: string       
}
