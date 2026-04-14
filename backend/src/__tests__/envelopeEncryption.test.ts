import { encrypt, decrypt } from "../crypto/envelopeEncryption";

describe("envelopeEncryption", () => {
  it("encrypts and decrypts back to the original value", async () => {
    const original = "super-secret-db-password-123";
    const encrypted = await encrypt(original);
    const result = await decrypt(encrypted);
    expect(result).toBe(original);
  });

  it("produces different ciphertexts for the same plaintext", async () => {
    const original = "same-value";
    const a = await encrypt(original);
    const b = await encrypt(original);
    expect(a.encrypted_value).not.toBe(b.encrypted_value);
  });

  it("throws a specific error when ciphertext is tampered with", async () => {
    const encrypted = await encrypt("sensitive-value");
    const tampered = {
      ...encrypted,
      encrypted_value: encrypted.encrypted_value.split("").reverse().join(""),
    };
    await expect(decrypt(tampered)).rejects.toThrow(
      "Decryption failed: ciphertext is invalid or has been tampered with",
    );
  });

  it("throws when encrypted_data_key is tampered with", async () => {
    const encrypted = await encrypt("another-value");
    const tampered = {
      ...encrypted,
      encrypted_data_key: "dGFtcGVyZWQ=",
    };
    await expect(decrypt(tampered)).rejects.toThrow();
  });

  it("encrypts empty string without error", async () => {
    const encrypted = await encrypt("");
    const result = await decrypt(encrypted);
    expect(result).toBe("");
  });

  it("encrypts long values correctly", async () => {
    const original = "x".repeat(10000);
    const encrypted = await encrypt(original);
    const result = await decrypt(encrypted);
    expect(result).toBe(original);
  });
});
