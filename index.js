import { dumpOffers } from "./dump.js";

await dumpOffers(
    {
        host: "localhost",
        port: 55400,
        key_path: "~\\.chia\\mainnet\\config\\ssl\\daemon\\private_daemon.key",
        cert_path: "~\\.chia\\mainnet\\config\\ssl\\daemon\\private_daemon.crt",
        timeout_seconds: 30,
    },
    420316971
);
