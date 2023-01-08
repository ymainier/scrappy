import { filenameParse } from "@ctrl/video-filename-parser";
import type { ParsedShow } from "@ctrl/video-filename-parser";
import { MovieDb } from "moviedb-promise";
import type {
  ShowResponse,
  TvSeasonResponse,
  Episode as TvEpisode,
} from "moviedb-promise";

export type Movie = {
  id: string;
  fullpath: string;
  title: string;
  description?: string;
  backdrop?: string;
  poster?: string;
};

type Show = {
  id: string;
  title: string;
  description?: string;
  backdrop?: string;
  poster?: string;
};

type Season = {
  id: string;
  title?: string;
  description?: string;
  number?: number;
  poster?: string;
};

type Episode = {
  id: string;
  title?: string;
  description?: string;
  number?: number;
  still?: string;
  fullpath: string;
};

export type ShowSeasonEpisode = {
  show: Show;
  season: Season;
  episode: Episode;
};

function imageUrl(base: string | undefined, path: string | undefined) {
  if (!path) return undefined;
  return base ? `${base}${path}` : path;
}

export class TMDB {
  #moviedb: MovieDb;
  showStringToShowIdPromise = new Map<string, Promise<number | undefined>>();
  showIdToShowDetailPromise = new Map<
    number,
    Promise<ShowResponse | undefined>
  >();
  showIdAndSeasonNumberToSeasonDetailPromise = new Map<
    `${number}-${number}`,
    Promise<TvSeasonResponse | undefined>
  >();

  constructor(key: string) {
    this.#moviedb = new MovieDb(key);
  }

  getMovie(fullpath: string, imageBaseUrl?: string | undefined): Promise<Movie> {
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
        return this.#moviedb.movieInfo({ id: search.results[0].id });
      })
      .then((movie) => ({
        id: typeof movie?.id === 'undefined' ? fullpath : `${movie?.id}`,
        fullpath,
        title: movie?.title || title,
        description: movie?.overview,
        backdrop: imageUrl(imageBaseUrl, movie?.backdrop_path),
        poster: imageUrl(imageBaseUrl, movie?.poster_path),
      }))
      .catch(() => ({ id: fullpath, title, fullpath }));
  }

  searchTvShow(
    title: string,
    year: number | undefined
  ): Promise<number | undefined> {
    if (this.showStringToShowIdPromise.has(title)) {
      return this.showStringToShowIdPromise.get(title)!;
    }

    const promise = this.#moviedb
      .searchTv({ query: title, first_air_date_year: year })
      .then((search) => search.results?.[0]?.id);
    this.showStringToShowIdPromise.set(title, promise);
    return promise;
  }

  searchShowDetails(id: number | undefined): Promise<ShowResponse | undefined> {
    if (typeof id === "undefined") {
      return Promise.resolve(undefined);
    }
    if (this.showIdToShowDetailPromise.has(id)) {
      return this.showIdToShowDetailPromise.get(id)!;
    }

    const promise = this.#moviedb.tvInfo({ id });
    this.showIdToShowDetailPromise.set(id, promise);
    return promise;
  }

  searchSeasonDetails(
    showId: number | undefined,
    seasonNumber: number
  ): Promise<TvSeasonResponse | undefined> {
    if (typeof showId === "undefined") {
      return Promise.resolve(undefined);
    }
    const id = `${showId}-${seasonNumber}` as const;
    if (this.showIdAndSeasonNumberToSeasonDetailPromise.has(id)) {
      return this.showIdAndSeasonNumberToSeasonDetailPromise.get(id)!;
    }
    const promise = this.#moviedb.seasonInfo({
      id: showId,
      season_number: seasonNumber,
    });
    this.showIdAndSeasonNumberToSeasonDetailPromise.set(id, promise);
    return promise;
  }

  searchShowSeasonEpisode(
    title: string,
    seasonNumber: number,
    episodeNumber: number,
    mayberYear: number | undefined,
    fullpath: string,
    imageBaseUrl: string | undefined
  ): Promise<ShowSeasonEpisode> {
    return this.searchTvShow(title, mayberYear).then((id) =>
      Promise.all([
        this.searchShowDetails(id),
        this.searchSeasonDetails(id, seasonNumber),
      ])
        .then(([show, season]) => {
          const episode: TvEpisode | undefined = (season?.episodes ?? []).find(
            (episode) => episode.episode_number === episodeNumber
          );
          return {
            show: {
              id: typeof show?.id === "number" ? `${show.id}` : title,
              title: show?.name ?? title,
              description: show?.overview,
              backdrop: imageUrl(
                imageBaseUrl,
                show?.backdrop_path ?? undefined
              ),
              poster: imageUrl(imageBaseUrl, show?.poster_path ?? undefined),
            },
            season: {
              id:
                typeof season?.id === "number"
                  ? `${season.id}`
                  : `${title}-${seasonNumber}`,
              title: season?.name,
              description: season?.overview,
              number: season?.season_number ?? seasonNumber,
              poster: imageUrl(imageBaseUrl, season?.poster_path ?? undefined),
            },
            episode: {
              id: typeof episode?.id === "number" ? `${episode.id}` : fullpath,
              title: episode?.name,
              description: episode?.overview,
              number: episode?.episode_number,
              still: imageUrl(imageBaseUrl, episode?.still_path ?? undefined),
              fullpath,
            },
          };
        })
        .catch(() => ({
          show: { id: title, title },
          season: { id: `${title}-${seasonNumber}`, number: seasonNumber },
          episode: { id: fullpath, fullpath },
        }))
    );
  }

  getTvShow(
    fullpath: string,
    imageBaseUrl?: string | undefined
  ): Promise<ShowSeasonEpisode> {
    const filename = fullpath.substring(
      fullpath.lastIndexOf("/") + 1,
      fullpath.lastIndexOf(".")
    );
    const parsedFilename = filenameParse(filename, true) as ParsedShow;
    const _title = parsedFilename.title;
    const seasonNumber = parsedFilename.seasons?.[0] || 1;
    const episodeNumber = parsedFilename.episodeNumbers?.[0] || 0;
    const matches = _title.match(
      /^(?<title>.*)(?: \(\(\((?<year>\d\d\d\d)\)\)\))$/
    );
    const title = matches?.groups?.title ?? _title;
    const maybYearAsString = matches?.groups?.year;
    const mayberYear = maybYearAsString
      ? parseInt(maybYearAsString, 10)
      : undefined;

    return this.searchShowSeasonEpisode(title, seasonNumber, episodeNumber, mayberYear, fullpath, imageBaseUrl)
  }
}
