#! /usr/bin/env node
import { getInput } from "./getInput.js";
import { promisePool } from "./promisePool.js";
import type { Movie } from "./tmdb.js";
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
  .then((settledMovies) =>
    settledMovies
      .filter(
        (s): s is PromiseFulfilledResult<Movie> => s.status === "fulfilled"
      )
      .map((s) => s.value)
  )
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((e) => console.error(e));
