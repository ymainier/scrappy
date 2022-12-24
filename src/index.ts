#! /usr/bin/env node
import { getInput } from "./getInput.js";
import { promisePool } from "./promisePool.js";
import { TMDB } from "./tmdb.js";

const { TMDB_API_KEY } = process.env;
if (!TMDB_API_KEY) {
  console.error("Error: API key not found.");
  console.error(
    "  Set your TheMovieDataBase API key in in the TMDB_API_KEY environment variable."
  );
  process.exit(-1);
}

const fullImageUrl = process.argv.includes("--full-image-url");

const tmdb = new TMDB(TMDB_API_KEY);

Promise.all([
  getInput(),
  fullImageUrl ? tmdb.getImageBaseUrl() : Promise.resolve(undefined),
])
  .then(([filenames, imageBaseUrl]) =>
    promisePool(
      filenames
        .split("\n")
        .filter(Boolean)
        .map((filename) => () => tmdb.getMovie(filename, imageBaseUrl)),
      2
    )
  )
  .then((result) => console.log(result))
  .catch((e) => console.error(e));
