import fs from "fs/promises";
import path from "path";
import os from "os";

export default class Cache {
    constructor(apiUri, analyticsUri) {
        this.apiUri = apiUri;
        this.analyticsUri = analyticsUri;
        this.cacheDir = path.join(os.homedir(), ".swap-utils");
        this.tokensCacheFile = path.join(this.cacheDir, "tokens.json");
        this.pairsCacheFile = path.join(this.cacheDir, "pairs.json");
    }

    async loadTokenList() {
        await this.ensureCacheDirExists();

        const tokensCache = await this.readCache(this.tokensCacheFile);
        const pairsCache = await this.readCache(this.pairsCacheFile);

        if (tokensCache && pairsCache) {
            return {
                tokens: tokensCache,
                pairs: pairsCache,
            };
        }

        const tokensResponse = await fetch(`${this.apiUri}/tokens`);
        const tokens = await tokensResponse.json();
        await this.writeCache(this.tokensCacheFile, tokens);

        const pairsResponse = await fetch(`${this.apiUri}/pairs?limit=750`);
        const pairs = await pairsResponse.json();
        await this.writeCache(this.pairsCacheFile, pairs);

        return {
            tokens: tokens,
            pairs: pairs,
        };
    }

    async ensureCacheDirExists() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (err) {
            console.error(`Failed to create cache directory: ${err.message}`);
            throw err;
        }
    }

    async readCache(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const oneDayInMillis = 24 * 60 * 60 * 1000;
            const now = Date.now();

            if (now - stats.mtimeMs < oneDayInMillis) {
                const data = await fs.readFile(filePath, "utf-8");
                return JSON.parse(data);
            }
        } catch (err) {
            console.log(
                "Cached file does not exist or is invalid, fetching new data",
            );
        }
        return null;
    }

    async writeCache(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data), "utf-8");
        } catch (err) {
            console.error(`Failed to write cache file: ${err.message}`);
            throw err;
        }
    }
}
