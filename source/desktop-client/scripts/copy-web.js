const fs = require("fs-extra")
const path = require("path")

const root = path.resolve(__dirname, "..", "..")
const source = path.join(root, "web-ui", "im-ui", "dist")
const target = path.join(root, "desktop-client", "web-dist")

if (!fs.existsSync(source)) {
  throw new Error(`Web dist not found: ${source}. Run npm run build in web-ui/im-ui first.`)
}

fs.emptyDirSync(target)
fs.copySync(source, target)
console.log(`Copied ${source} -> ${target}`)
