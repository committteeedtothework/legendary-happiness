import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
export function testCertificate() {
  const directory = mkdtempSync(join(tmpdir(), "dcsmcraft-test-tls-")),
    certPath = join(directory, "cert.pem"),
    keyPath = join(directory, "key.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      keyPath,
      "-out",
      certPath,
    ],
    { stdio: "ignore" },
  );
  return {
    directory,
    certPath,
    keyPath,
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}
