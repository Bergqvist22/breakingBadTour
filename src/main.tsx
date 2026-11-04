import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useRoute } from "./router";
import { StartPage } from "./StartPage";
import { TripNotFound, TripPage } from "./TripPage";
import "./styles.css";

function App() {
  const route = useRoute();
  switch (route.page) {
    case "start":
      return <StartPage />;
    case "trip":
      // Keyed so switching between Trips starts each page fresh.
      return <TripPage key={route.tripId} tripId={route.tripId} />;
    case "unknown":
      return <TripNotFound />;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
