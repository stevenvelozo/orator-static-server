# Getting Started

## Installation

Static file serving is built into the main `orator` module:

```bash
npm install fable orator orator-serviceserver-restify
```

## Basic Static Server

The simplest static file server:

```javascript
const libFable = require('fable');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');

const _Fable = new libFable({
	Product: 'DevServer',
	ServicePort: 8080
});

_Fable.serviceManager.addServiceType('Orator', libOrator);
_Fable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);
_Fable.serviceManager.instantiateServiceProvider('Orator');
_Fable.serviceManager.instantiateServiceProvider('OratorServiceServer');

// Serve files from ./public, defaulting to index.html
_Fable.Orator.addStaticRoute('./public/');

_Fable.Orator.startService(
	() =>
	{
		_Fable.log.info('Static server is ready');
	});
```

## Single Page Application

For SPAs where all routes should resolve to `index.html`:

```javascript
_Fable.Orator.addStaticRoute('./dist/', 'index.html', '/*');
```

## API Server with Static Frontend

Register your API routes first, then add static file serving as a catch-all:

```javascript
// API routes
_Fable.Orator.serviceServer.get('/api/users',
	(pRequest, pResponse, fNext) =>
	{
		pResponse.send([{ id: 1, name: 'User One' }]);
		return fNext();
	});

_Fable.Orator.serviceServer.postWithBodyParser('/api/users',
	(pRequest, pResponse, fNext) =>
	{
		pResponse.send({ created: true });
		return fNext();
	});

// Static files for everything else
_Fable.Orator.addStaticRoute('./public/', 'index.html', '/*');
```

## Serving Under a Subpath

If your static files should be served under a URL prefix:

```javascript
// /app/styles.css serves ./dist/styles.css
_Fable.Orator.addStaticRoute('./dist/', 'index.html', '/app/*', '/app/');
```

## Next Steps

- [API Reference](api-reference.md) - Complete parameter documentation
- [Subdomain Routing](subdomain-routing.md) - Multi-tenant static hosting
