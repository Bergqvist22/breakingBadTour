import { followLink } from "./router";

/** A periodic-table element tile: atomic number, symbol and atomic mass. */
function ElementTile({ number, symbol, mass }: { number: number; symbol: string; mass: string }) {
  return (
    <span className="element-tile" aria-hidden="true">
      <span className="element-number">{number}</span>
      <span className="element-symbol">{symbol}</span>
      <span className="element-mass">{mass}</span>
    </span>
  );
}

/** "Breaking Bad Tour" with Br and Ba as element tiles, built in code (no image). */
function TitleTiles() {
  return (
    <span className="app-title-tiles">
      <span className="app-title-word">
        <ElementTile number={35} symbol="Br" mass="79.904" />
        <span className="app-title-rest">eaking</span>
      </span>
      <span className="app-title-word app-title-indent">
        <ElementTile number={56} symbol="Ba" mass="137.33" />
        <span className="app-title-rest">d</span>
        <span className="app-title-tour">Tour</span>
      </span>
    </span>
  );
}

/** The app's title as the start page's main heading. */
export function AppTitle() {
  return (
    <h1 className="app-title" aria-label="Breaking Bad Tour">
      <TitleTiles />
    </h1>
  );
}

/** The app's title, small, as a link back to all Trips (the Trip page's own heading is the Trip name). */
export function AppTitleLink() {
  return (
    <a
      className="app-title app-title-small"
      href="/"
      onClick={followLink}
      aria-label="Breaking Bad Tour: all Trips"
    >
      <TitleTiles />
    </a>
  );
}
