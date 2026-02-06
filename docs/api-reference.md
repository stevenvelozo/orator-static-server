# API Reference

## addStaticRoute(pFilePath, pDefaultFile, pRoute, pRouteStrip, pParams)

Registers a GET route handler that serves static files from a directory on disk.

### Parameters

| Parameter | Type | Default | Required | Description |
|-----------|------|---------|----------|-------------|
| `pFilePath` | string | - | Yes | Path to the directory to serve files from |
| `pDefaultFile` | string | `"index.html"` | No | Default file when no specific file is requested |
| `pRoute` | string | `"/*"` | No | Route pattern to match for static file requests |
| `pRouteStrip` | string | `"/"` | No | Prefix to strip from URL paths before filesystem lookup |
| `pParams` | object | `{}` | No | Additional options passed to the `serve-static` library |

### Returns

`true` if the route was successfully installed, `false` if `pFilePath` is not a string.

### Examples

**Minimal:**
```javascript
_Fable.Orator.addStaticRoute('./public/');
```

**With default file:**
```javascript
_Fable.Orator.addStaticRoute('./public/', 'app.html');
```

**With custom route:**
```javascript
_Fable.Orator.addStaticRoute('./public/', 'index.html', '/static/*');
```

**With route stripping:**
```javascript
_Fable.Orator.addStaticRoute('./dist/', 'index.html', '/app/*', '/app/');
```

**With serve-static options:**
```javascript
_Fable.Orator.addStaticRoute('./public/', 'index.html', '/*', '/',
	{
		maxAge: '1d',
		etag: true
	});
```

## MIME Type Detection

Orator automatically sets the `Content-Type` response header based on the requested file's extension. It uses the `mime` library for detection and defaults to `application/octet-stream` for unknown file types.

The module handles both v1 and v2 of the `mime` library transparently, using `mime.lookup()` or `mime.getType()` depending on which is available.

## serve-static Options

The `pParams` parameter is passed directly to [serve-static](https://github.com/expressjs/serve-static). Some useful options:

| Option | Type | Description |
|--------|------|-------------|
| `maxAge` | number/string | Set the Cache-Control max-age header (in ms or as a string like `'1d'`) |
| `etag` | boolean | Generate ETags for files |
| `dotfiles` | string | How to handle dotfiles: `'allow'`, `'deny'`, or `'ignore'` |
| `redirect` | boolean | Redirect to trailing `/` when pathname is a directory |
| `index` | string/boolean | Override the default file (set to `false` to disable) |
