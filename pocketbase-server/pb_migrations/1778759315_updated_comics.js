/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_440763926")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_440763926")

  // update collection data
  unmarshal({
    "deleteRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
