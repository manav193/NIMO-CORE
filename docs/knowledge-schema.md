# Knowledge schema

Every source requires `id`, `version`, and `projects`. Registration validates the full source before mutating the registry and rejects duplicate project IDs.

Project fields:

- Required: `id`, `name`, `summary`.
- Identity: `aliases`, `category`, `type`, `keywords`.
- Facts: `technologies`, `capabilities`, `limitations`.
- Navigation: `routes`, `liveUrl`, `caseStudyUrl`, `supportedActions`.
- Tool metadata: `acceptedFormats`, `outputFormats`, `processingMode`.
- Provenance: `sourceApplication`, `lastUpdatedVersion`.

ToolVerse manifests use:

```json
{
  "version": "1.0.0",
  "tools": [{
    "id": "compress-image",
    "name": "Compress Image",
    "category": "image",
    "description": "Compress an image in the browser.",
    "route": "tools/compress-image.html",
    "keywords": ["compress", "image", "target size"],
    "acceptedFormats": ["image/jpeg", "image/png"],
    "outputFormats": ["image/jpeg"],
    "processingMode": "local",
    "capabilities": ["reduce image file size"],
    "limitations": []
  }]
}
```

Facts omitted by a source remain undeclared. The adapter never infers formats, processing mode, capabilities, or limitations.
