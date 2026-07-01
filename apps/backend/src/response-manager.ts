import { ResponseManager } from '../util.ts';

let _instance: ResponseManager | null = null;

function getInstance() {
  if (!_instance) throw new Error('ResponseManager not initialized');
  return _instance;
}

export const responseManager = {
  putRequest: (...args: Parameters<ResponseManager['putRequest']>) =>
    getInstance().putRequest(...args),
};

export async function initResponseManager() {
  _instance = await ResponseManager.create();
}
