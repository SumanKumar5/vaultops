import crypto from "crypto";
import { env } from "../config/env";

export interface EncryptedSecret {
  encrypted_value: string;
  encrypted_data_key: string;
  kms_key_id: string;
}

async function fetchDataKey(): Promise<{
  plaintext_key: Buffer;
  encrypted_key: string;
  kms_key_id: string;
}> {
  const response = await fetch(`${env.KMS_URL}/generate-data-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok)
    throw new Error(`KMS generate-data-key failed: ${response.status}`);
  const body = (await response.json()) as {
    plaintext_key: string;
    encrypted_key: string;
    kms_key_id: string;
  };
  return {
    plaintext_key: Buffer.from(body.plaintext_key, "base64"),
    encrypted_key: body.encrypted_key,
    kms_key_id: body.kms_key_id,
  };
}

async function decryptDataKey(
  encrypted_key: string,
  kms_key_id: string,
): Promise<Buffer> {
  const response = await fetch(`${env.KMS_URL}/decrypt-data-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_key, kms_key_id }),
  });
  if (!response.ok)
    throw new Error(`KMS decrypt-data-key failed: ${response.status}`);
  const body = (await response.json()) as { plaintext_key: string };
  return Buffer.from(body.plaintext_key, "base64");
}

export async function encrypt(plaintext: string): Promise<EncryptedSecret> {
  const { plaintext_key, encrypted_key, kms_key_id } = await fetchDataKey();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", plaintext_key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  plaintext_key.fill(0);

  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");

  return {
    encrypted_value: payload,
    encrypted_data_key: encrypted_key,
    kms_key_id,
  };
}

export async function decrypt(encrypted: EncryptedSecret): Promise<string> {
  const dataKey = await decryptDataKey(
    encrypted.encrypted_data_key,
    encrypted.kms_key_id,
  );

  try {
    const buf = Buffer.from(encrypted.encrypted_value, "base64");
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "Decryption failed: ciphertext is invalid or has been tampered with",
    );
  } finally {
    dataKey.fill(0);
  }
}
