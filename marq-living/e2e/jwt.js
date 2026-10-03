const crypto = require("crypto");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const secret = process.argv[2], role = process.argv[3];
const h = b64({ alg: "HS256", typ: "JWT" });
const p = b64({ iss: "supabase-demo", role, exp: 2000000000 });
const s = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
console.log(`${h}.${p}.${s}`);
