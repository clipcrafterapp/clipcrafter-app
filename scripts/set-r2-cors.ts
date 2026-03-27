import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "../src/lib/r2";

async function setCors() {
  await r2Client.send(new PutBucketCorsCommand({
    Bucket: R2_BUCKET,
    CORSConfiguration: {
      CORSRules: [{
        AllowedOrigins: ["https://toolnexus-app.vercel.app", "http://localhost:3000"],
        AllowedMethods: ["PUT", "GET"],
        AllowedHeaders: ["*"],
        MaxAgeSeconds: 3600,
      }],
    },
  }));
  console.log("CORS set successfully");
}
setCors().catch(console.error);
