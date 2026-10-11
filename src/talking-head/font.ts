import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Font incluso in public/fonts: funziona anche offline
export const fontFamily = "Montserrat";

loadFont({
  family: fontFamily,
  url: staticFile("fonts/Montserrat-900.woff2"),
  weight: "100 900",
});
