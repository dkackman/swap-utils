import { dumpOffers } from "./dump.js";

await dumpOffers({
  "host": "former",
  "port": 55400,
  "key_path": "C:\\Users\\don\\.rchia\\certs\\former\\private_daemon.key",
  "cert_path": "C:\\Users\\don\\.rchia\\certs\\former\\private_daemon.crt",
  "timeout_seconds": 30,
  "fingerprint": 420316971,
});

