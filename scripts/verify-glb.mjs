import fs from "node:fs";
import path from "node:path";

const glbPath = path.join(process.cwd(), "public/assets/main/main.glb");
const buf = fs.readFileSync(glbPath);

const size = buf.length;
if (size < 1000) {
  console.error(`VERIFY FAIL size too small size=${size}`);
  process.exit(1);
}

const magic = buf.subarray(0, 4).toString("ascii");
if (magic !== "glTF") {
  console.error(`VERIFY FAIL bad magic magic=${magic}`);
  process.exit(1);
}

const declaredLength = buf.readUInt32LE(8);
if (declaredLength !== size) {
  console.error(`VERIFY FAIL length mismatch declared=${declaredLength} actual=${size}`);
  process.exit(1);
}

console.log(`VERIFY OK size=${size} length=${declaredLength}`);
