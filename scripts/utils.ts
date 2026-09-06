import { v7 as uuidv7 } from "uuid";
export function genId() {
  const id = uuidv7();
  return id;
}