// Cloudinary storage with the SDK's network calls replaced: nothing leaves this machine.
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

// set before the app reads its settings
process.env.CLOUDINARY_URL = "cloudinary://123456:not-a-real-secret@demo-cloud";
const uploads = await import("../src/uploads.js");
const { productPublicId } = await import("../src/cloud.js");

type Options = { public_id: string; type: string };
const sent: Options[] = [];
const destroyed: [string, string][] = [];

mock.method(cloudinary.uploader, "upload_stream", ((options: Options, done: (e: unknown, r: unknown) => void) => ({
  end: () => {
    sent.push(options);
    done(undefined, { secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v1/${options.public_id}.webp` });
  },
})) as never);
mock.method(cloudinary.uploader, "destroy", (async (id: string, o: { type: string }) => {
  destroyed.push([id, o.type]);
}) as never);

const png = () => sharp({ create: { width: 20, height: 20, channels: 3, background: "#123" } }).png().toBuffer();

describe("cloudinary storage", () => {
  it("uploads a product photo publicly and deletes only our own", async () => {
    const url = await uploads.saveProductImage(await png());
    assert.match(url, /^https:\/\/res\.cloudinary\.com\/demo-cloud\/image\/upload\/v1\/aisha\/products\/[a-f0-9]{24}\.webp$/);
    assert.equal(sent.at(-1)!.type, "upload");

    await uploads.removeUpload(url);
    assert.equal(destroyed.at(-1)![0], productPublicId(url));

    const before = destroyed.length;
    await uploads.removeUpload("https://res.cloudinary.com/someone-else/image/upload/v1/aisha/products/abc.webp");
    await uploads.removeUpload("https://example.com/aisha/products/abc.webp");
    assert.equal(destroyed.length, before);
  });

  it("keeps transfer screenshots authenticated and reads them with a signed link", async () => {
    const name = await uploads.saveProof(await png());
    assert.match(name, /^[a-f0-9]{32}\.webp$/);
    assert.equal(sent.at(-1)!.type, "authenticated");

    const fetched = mock.method(globalThis, "fetch", async () => new Response(new Uint8Array([1, 2, 3])));
    assert.deepEqual(await uploads.readProof(name), Buffer.from([1, 2, 3]));
    const link = String(fetched.mock.calls[0].arguments[0]);
    assert.match(link, /\/demo-cloud\/image\/authenticated\/s--[\w-]+--\//);
    assert.ok(!link.includes("not-a-real-secret"));
    fetched.mock.restore();

    assert.equal(await uploads.readProof("../../etc/passwd"), null);
    await uploads.removeProof(name);
    assert.deepEqual(destroyed.at(-1), [`aisha/proofs/${name.replace(".webp", "")}`, "authenticated"]);
  });
});
