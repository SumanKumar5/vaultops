import { expireStaleRequests } from "./changeRequests.service";

export function startExpiryJob(intervalMs = 60_000) {
  expireStaleRequests().catch(console.error);
  const handle = setInterval(() => {
    expireStaleRequests().catch(console.error);
  }, intervalMs);
  return handle;
}
