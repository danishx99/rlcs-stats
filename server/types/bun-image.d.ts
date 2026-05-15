declare namespace Bun {
  interface ImageResizeOptions {
    fit?: "inside" | "outside" | "cover" | "contain" | "fill";
    withoutEnlargement?: boolean;
    filter?:
      | "nearest"
      | "box"
      | "bilinear"
      | "cubic"
      | "mitchell"
      | "lanczos2"
      | "lanczos3"
      | "mks2013"
      | "mks2021";
  }

  interface WebpEncodeOptions {
    quality?: number;
    effort?: number;
  }

  class Image {
    constructor(source: ArrayBufferLike | Uint8Array | Buffer | Blob | string);
    resize(width: number, height?: number, options?: ImageResizeOptions): Image;
    webp(options?: WebpEncodeOptions): Image;
    buffer(): Promise<Buffer>;
    bytes(): Promise<Uint8Array>;
  }
}
