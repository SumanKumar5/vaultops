import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import express, { Request, Response } from "express";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use(express.json());

const KMS_PORT = process.env.KMS_PORT ? parseInt(process.env.KMS_PORT) : 3001;

const MASTER_KEYS: Record<string, Buffer> = {
  "master-key-v1": crypto.randomBytes(32),
  "master-key-v2": crypto.randomBytes(32),
};

const CURRENT_MASTER_KEY_ID = "master-key-v1";

function encryptWithMasterKey(keyId: string, plaintext: Buffer): string {
  const masterKey = MASTER_KEYS[keyId];
  if (!masterKey) throw new Error(`Unknown KMS key: ${keyId}`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decryptWithMasterKey(keyId: string, ciphertext: string): Buffer {
  const masterKey = MASTER_KEYS[keyId];
  if (!masterKey) throw new Error(`Unknown KMS key: ${keyId}`);
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

app.post("/generate-data-key", (_req: Request, res: Response) => {
  const plaintextKey = crypto.randomBytes(32);
  const encryptedKey = encryptWithMasterKey(
    CURRENT_MASTER_KEY_ID,
    plaintextKey,
  );
  res.json({
    plaintext_key: plaintextKey.toString("base64"),
    encrypted_key: encryptedKey,
    kms_key_id: CURRENT_MASTER_KEY_ID,
  });
});

app.post("/decrypt-data-key", (req: Request, res: Response) => {
  const { encrypted_key, kms_key_id } = req.body;
  if (!encrypted_key || !kms_key_id) {
    res
      .status(400)
      .json({ error: "encrypted_key and kms_key_id are required" });
    return;
  }
  const plaintextKey = decryptWithMasterKey(kms_key_id, encrypted_key);
  res.json({ plaintext_key: plaintextKey.toString("base64") });
});

app.post("/rotate-master-key", (_req: Request, res: Response) => {
  const newKeyId = `master-key-v${Object.keys(MASTER_KEYS).length + 1}`;
  MASTER_KEYS[newKeyId] = crypto.randomBytes(32);
  res.json({ new_key_id: newKeyId, rotated_at: new Date().toISOString() });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", active_key: CURRENT_MASTER_KEY_ID });
});

app.listen(KMS_PORT, () => {
  console.log(`Mock KMS running on port ${KMS_PORT}`);
});

export default app;
