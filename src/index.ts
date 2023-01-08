#! /usr/bin/env node
import { getInput } from "./getInput.js";
import { promisePool } from "./promisePool.js";
import type { Movie, ShowSeasonEpisode } from "./tmdb.js";
import { TMDB } from "./tmdb.js";

const { TMDB_API_KEY } = process.env;
if (!TMDB_API_KEY) {
  console.error("Error: API key not found.");
  console.error(
    "  Set your TheMovieDataBase API key in the TMDB_API_KEY environment variable."
  );
  process.exit(-1);
}

const areTvShows = process.argv.includes("--tv-shows");

const tmdb = new TMDB(TMDB_API_KEY);

async function getData<T, U>(
  fileToPromiseDataGetter: (filename: string) => () => Promise<T>,
  transformer: (data: Array<T>) => U
): Promise<U> {
  const filenames = await getInput();
  const promises = filenames
    .split("\n")
    .filter(Boolean)
    .map(fileToPromiseDataGetter);
  const settledData = await promisePool(promises, 2);
  const array = settledData
    .filter((s): s is PromiseFulfilledResult<T> => s.status === "fulfilled")
    .map((s) => s.value);
  return transformer(array);
}

type ShowCollection = Record<
  ShowSeasonEpisode["show"]["id"],
  Record<
    ShowSeasonEpisode["season"]["id"],
    Array<ShowSeasonEpisode["episode"]["id"]>
  >
>;

type ShowResult = {
  shows: Record<string, ShowSeasonEpisode["show"]>;
  seasons: Record<string, ShowSeasonEpisode["season"]>;
  episodes: Record<string, ShowSeasonEpisode["episode"]>;
  data: ShowCollection;
};

const getDataArgsForShows = [
  (filename: string) => () => tmdb.getTvShow(filename),
  (array: Array<ShowSeasonEpisode>) => {
    const showMap = array
      .sort((s1, s2) => {
        if (s1.show.title !== s2.show.title) {
          return s1.show.title.localeCompare(s2.show.title);
        }
        if ((s1.season.number ?? Infinity) !== (s2.season.number ?? Infinity)) {
          return (
            (s1.season.number ?? Infinity) - (s2.season.number ?? Infinity)
          );
        }
        if (
          (s1.episode.number ?? Infinity) !== (s2.episode.number ?? Infinity)
        ) {
          return (
            (s1.episode.number ?? Infinity) - (s2.episode.number ?? Infinity)
          );
        }
        return s1.episode.fullpath.localeCompare(s2.episode.fullpath);
      })
      .reduce<ShowResult>(
        (map, { show, season, episode }) => {
          map.shows[show.id] = show;
          map.seasons[season.id] = season;
          map.episodes[episode.id] = episode;
          map.data[show.id] = map.data[show.id] ?? {};
          map.data[show.id][season.id] = map.data[show.id][season.id] ?? [];
          if (!map.data[show.id][season.id].includes(episode.id)) {
            map.data[show.id][season.id].push(episode.id);
          }
          return map;
        },
        { shows: {}, seasons: {}, episodes: {}, data: {} }
      );
    return showMap;
  },
] as const;

const getDataArgsForMovies = [
  (filename: string) => () => tmdb.getMovie(filename),
  (
    movieArray: Array<Movie>
  ): { movies: Record<Movie["id"], Movie>; data: Array<Movie["id"]> } => {
    const movies = movieArray.reduce<Record<Movie["id"], Movie>>(
      (movies, movie) => {
        movies[movie.id] = movie;
        return movies;
      },
      {}
    );
    const data = movieArray
      .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
      .map((m) => m.id);
    return { movies, data };
  },
] as const;

(areTvShows
  ? getData(...getDataArgsForShows)
  : getData(...getDataArgsForMovies)
)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((e) => console.error(e));
