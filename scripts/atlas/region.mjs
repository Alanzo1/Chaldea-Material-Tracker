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
  const jp = region === "JP"
  const lang = jp ? "?lang=en" : ""
  return {
    region,
    // Separate directories: replacing NA output must never remove JP output.
    outDir: join(cwd, "public", region === "NA" ? "data" : "data-jp"),
    // JP names come from Atlas's English exports; the Japanese name stays in `originalName`.
    exportUrl: (name) => `${BASE_URL}/export/${region}/${name}${jp ? "_lang_en" : ""}.json`,
    questPhaseUrl: (id, phase) => `${BASE_URL}/nice/${region}/quest/${id}/${phase}${lang}`,
    basicServantUrl: (id) => `${BASE_URL}/basic/${region}/servant/${id}${lang}`,
    warUrl: (id) => `${BASE_URL}/nice/${region}/war/${id}${lang}`,
    // Atlas's war export isn't translated; JP re-fetches the wars it uses from the translated endpoint.
    translateWars: jp,
    effectNamesUrl: jp ? `${BASE_URL}/export/NA/nice_servant.json` : null,
  }
}
