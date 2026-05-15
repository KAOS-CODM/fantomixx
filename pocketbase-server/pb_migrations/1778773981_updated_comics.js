/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_440763926")

  // update field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "file2366146245",
    "maxSelect": 0,
    "maxSize": 0,
    "mimeTypes": [
      "image/jpeg",
      "image/jxl",
      "image/jp2",
      "image/jpx",
      "image/vnd.mozilla.apng",
      "image/jpm",
      "image/jxs",
      "image/webp",
      "image/x-xpixmap",
      "image/vnd.adobe.photoshop",
      "image/png",
      "image/gif",
      "image/x-icon",
      "image/bmp",
      "image/tiff",
      "image/avif",
      "image/heic",
      "image/heic-sequence",
      "image/heif",
      "image/heif-sequence",
      "image/vnd.djvu",
      "image/bpg",
      "image/x-icns",
      "image/vnd.dwg",
      "image/vnd.radiance",
      "image/x-xcf",
      "image/x-gimp-pat",
      "image/x-gimp-gbr",
      "image/jxr",
      "image/svg+xml",
      "image/x-portable-bitmap",
      "image/x-portable-graymap",
      "image/x-portable-pixmap"
    ],
    "name": "cover",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": null,
    "type": "file"
  }))

  // update field
  collection.fields.addAt(10, new Field({
    "exceptDomains": null,
    "help": "",
    "hidden": false,
    "id": "url2366146245",
    "name": "cover_url",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_440763926")

  // update field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "file2366146245",
    "maxSelect": 0,
    "maxSize": 0,
    "mimeTypes": [
      "image/jpeg",
      "image/jxl",
      "image/jp2",
      "image/jpx",
      "image/vnd.mozilla.apng",
      "image/jpm",
      "image/jxs",
      "image/webp",
      "image/x-xpixmap",
      "image/vnd.adobe.photoshop",
      "image/png",
      "image/gif",
      "image/x-icon",
      "image/bmp",
      "image/tiff",
      "image/avif",
      "image/heic",
      "image/heic-sequence",
      "image/heif",
      "image/heif-sequence",
      "image/vnd.djvu",
      "image/bpg",
      "image/x-icns",
      "image/vnd.dwg",
      "image/vnd.radiance",
      "image/x-xcf",
      "image/x-gimp-pat",
      "image/x-gimp-gbr",
      "image/jxr",
      "image/svg+xml",
      "image/x-portable-bitmap",
      "image/x-portable-graymap",
      "image/x-portable-pixmap"
    ],
    "name": "na",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": null,
    "type": "file"
  }))

  // update field
  collection.fields.addAt(10, new Field({
    "exceptDomains": null,
    "help": "",
    "hidden": false,
    "id": "url2366146245",
    "name": "cover",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  return app.save(collection)
})
