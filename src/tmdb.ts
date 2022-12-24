import { filenameParse } from "@ctrl/video-filename-parser";
import { MovieDb } from "moviedb-promise";

export type Movie = {
  id: number | undefined;
  fullpath: string;
  title: string;
  description: string | undefined;
  backdrop: string | undefined;
  poster: string | undefined;
};

function imageUrl(base: string | undefined, path: string | undefined) {
  if (!path) return undefined
  return base ? `${base}${path}` : path;
}

export class TMDB {
  #moviedb: MovieDb;

  constructor(key: string) {
    this.#moviedb = new MovieDb(key);
  }

  getMovie(fullpath: string, imageBaseUrl: string | undefined): Promise<Movie> {
    const filename = fullpath.substring(
      fullpath.lastIndexOf("/") + 1,
      fullpath.lastIndexOf(".")
    );
    const { title, year: _year } = filenameParse(filename);
    const year = _year ? parseInt(_year, 10) : undefined;
    return this.#moviedb
      .searchMovie({ query: title, year })
      .then((search) => {
        if (!search.results?.[0]?.id) {
          return;
        }
        return this.#moviedb.movieInfo({
          id: search.results[0].id,
          append_to_response: "images,videos",
        });
      })
      .then((movie) => ({
        id: movie?.id,
        fullpath,
        title: movie?.title || title,
        description: movie?.overview,
        backdrop: imageUrl(imageBaseUrl, movie?.backdrop_path),
        poster: imageUrl(imageBaseUrl, movie?.poster_path),
      }));
  }

  getImageBaseUrl(): Promise<string | undefined> {
    return this.#moviedb
      .configuration()
      .then(({ images }) =>
        images.secure_base_url ? `${images.secure_base_url}original` : undefined
      );
  }
}
