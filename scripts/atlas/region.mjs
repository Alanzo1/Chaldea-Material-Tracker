import { join } from "node:path"

const BASE_URL = "https://api.atlasacademy.io"

export function createRegionConfig(args = [], cwd = process.cwd()) {
  let region = "NA"
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--region" || !["NA", "JP"].includes(args[1])) {
      throw new Error("Usage: node scripts/atlas/build.mjs [--region NA|JP]")
    }
    region = args[1]
  }
  return {
    region,
    // Separate directories: replacing NA output must never remove JP output. JP stays outside
    // public/ until the site uses it, so it isn't shipped with every deployment.
    outDir: region === "NA" ? join(cwd, "public", "data") : join(cwd, "data", "jp"),
    exportUrl: (name) => `${BASE_URL}/export/${region}/${name}.json`,
    questPhaseUrl: (id, phase) => `${BASE_URL}/nice/${region}/quest/${id}/${phase}`,
    basicServantUrl: (id) => `${BASE_URL}/basic/${region}/servant/${id}`,
  }
}
