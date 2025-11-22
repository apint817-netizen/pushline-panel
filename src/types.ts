import type { InboxMsg as ApiInboxMsg, Operator as ApiOperator } from "./api";

export type Msg = ApiInboxMsg;
export type Operator = ApiOperator;

export type Toast = { id: string; text: string };
