# Orator Static Server

> Static file serving for Orator API servers

Orator Static Server provides static file serving capabilities for Orator. The core static file serving functionality is built directly into the main [orator](https://github.com/stevenvelozo/orator) module via the `addStaticRoute` method, which serves files from disk with MIME type detection and subdomain-based folder routing.

## Features

- **File Serving** - Serve static files from any directory on disk
- **MIME Detection** - Automatic Content-Type headers based on file extension
- **Default Files** - Configurable default file (e.g., `index.html`) for directory requests
- **Route Stripping** - Strip URL prefixes before mapping to the filesystem
- **Subdomain Routing** - Serve different folders based on request subdomain

## Usage

Static file serving is available through the main Orator module's `addStaticRoute` method:

```javascript
const libFable = require('fable');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');

const _Fable = new libFable({
	Product: 'MyStaticServer',
	ServicePort: 8080
});

_Fable.serviceManager.addServiceType('Orator', libOrator);
_Fable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);
_Fable.serviceManager.instantiateServiceProvider('Orator');
_Fable.serviceManager.instantiateServiceProvider('OratorServiceServer');

// Serve static files from ./public
_Fable.Orator.addStaticRoute('./public/');

_Fable.Orator.startService();
```

## API

### addStaticRoute(pFilePath, pDefaultFile, pRoute, pRouteStrip, pParams)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pFilePath` | string | *required* | Path to the directory to serve files from |
| `pDefaultFile` | string | `"index.html"` | Default file for directory requests |
| `pRoute` | string | `"/*"` | Route pattern to match |
| `pRouteStrip` | string | `"/"` | URL prefix to strip before filesystem lookup |
| `pParams` | object | `{}` | Options passed to `serve-static` |

## Examples

### Single Page Application

```javascript
// All routes fall back to index.html
_Fable.Orator.addStaticRoute('./dist/', 'index.html', '/*');
```

### Serving Under a Subpath

```javascript
// /app/styles.css serves ./dist/styles.css
_Fable.Orator.addStaticRoute('./dist/', 'index.html', '/app/*', '/app/');
```

### API Server with Static Frontend

```javascript
// API routes first
_Fable.Orator.serviceServer.get('/api/data',
	(pRequest, pResponse, fNext) =>
	{
		pResponse.send({ value: 42 });
		return fNext();
	});

// Static files for everything else
_Fable.Orator.addStaticRoute('./public/', 'index.html', '/*');
```

## Subdomain Folder Routing

When a request arrives with a subdomain, Orator checks if a matching subfolder exists in the serve directory. If it does, files are served from that subfolder.

For a serve path of `./sites/`:
- `http://clienta.example.com/page.html` checks for `./sites/clienta/page.html`
- If `./sites/clienta/` exists, it serves from there
- Otherwise, falls back to `./sites/page.html`

## Documentation

Full documentation is available in the [`docs`](./docs) folder, or served locally:

```bash
npx docsify-cli serve docs
```

## Related Packages

- [orator](https://github.com/stevenvelozo/orator) - Main Orator service (includes addStaticRoute)
- [orator-serviceserver-restify](https://github.com/stevenvelozo/orator-serviceserver-restify) - Restify service server
- [fable](https://github.com/stevenvelozo/fable) - Service provider framework
