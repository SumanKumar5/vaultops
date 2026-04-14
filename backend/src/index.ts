import app from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(`VaultOps API running on port ${env.PORT}`);
});
