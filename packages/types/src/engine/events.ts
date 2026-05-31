import type { CreateMarketRequest, CreateOrderRequest, CreateUserRequest, DeleteOrderRequest, GetDepthRequest, GetEquityRequest, GetPositionsRequest, RampUserRequest } from "./request";
import type { OrderFilledResponse, OrderFilledPartiallyResponse, OrderRejectedResponse, OrderAcceptedResponse, CreateUserResponse, CreateMarketResponse, RampUserResponse, DeleteOrderResponse, OpenPositionsResponse, ClosedPositionsResponse, GetEquityResponse, GetDepthResponse } from "./response";

export type EngineEvent = "ORDER_FILLED_PARTIALLY"|"ORDER_FILLED"|"ORDER_ACCEPTED"|"ORDER_REJECTED";

export type EngineResponse =
  {
    [K in keyof EventMap]: {
      event: K;
      payload: EventMap[K];
    };
  }[keyof EventMap];


  export type EngineRequest = {
  [K in keyof EngineRequestMap]:{
      type:K,
      payload:EngineRequestMap[K]
  }
  }[keyof EngineRequestMap]
  

interface EventResponseMap{
    "ORDER_FILLED":OrderFilledResponse,
    "ORDER_FILLED_PARTIALLY":OrderFilledPartiallyResponse,
    "ORDER_REJECTED":OrderRejectedResponse,
    "ORDER_ACCEPTED":OrderAcceptedResponse,
    "CREATE_USER":CreateUserResponse,
    "CREATE_MARKET":CreateMarketResponse,
    "RAMP_USER":RampUserResponse,
    "DELETE_ORDER":DeleteOrderResponse,
    "GET_OPEN_POSITIONS":OpenPositionsResponse,
    "GET_CLOSED_POSITIONS":ClosedPositionsResponse,
    "GET_EQUITY":GetEquityResponse,
    "GET_DEPTH":GetDepthResponse
}



interface EngineRequestMap{
        "CREATE_ORDER":CreateOrderRequest,
        "CREATE_USER":CreateUserRequest,
        "CREATE_MARKET":CreateMarketRequest,
        "RAMP_USER":RampUserRequest,
        "DELETE_ORDER":DeleteOrderRequest,
        "GET_OPEN_POSITIONS":GetPositionsRequest,
        "GET_CLOSED_POSITIONS":GetPositionsRequest,
        "GET_EQUITY":GetEquityRequest,
        "GET_DEPTH":GetDepthRequest
}