// Guardarlo como frontend-bun-ejs/scripts/generate-icons.ts y ejecutarlo
import { join } from "node:path";

const publicIconsDir = "./public/icons";

// Fallback: copiar el 128 como placeholder para los otros tamaños
await Bun.write(join(publicIconsDir, "icon-192.png"), Bun.file(join(publicIconsDir, "icon-128.png")));
await Bun.write(join(publicIconsDir, "icon-512.png"), Bun.file(join(publicIconsDir, "icon-128.png")));
console.log("✅ Icons copied as fallback (128px source)");
