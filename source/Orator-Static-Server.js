/**
* Orator Static Server
*
* A convenience module that provides static file serving for Orator API servers.
* The core addStaticRoute functionality lives on the Orator class itself; this
* module provides a service-provider wrapper for programmatic access.
*
* @license MIT
*
* @author Steven Velozo <steven@velozo.com>
*/

const libFableServiceProviderBase = require('fable-serviceproviderbase');

/**
 * @class OratorStaticServer
 * @extends libFableServiceProviderBase
 *
 * A service provider that configures static file serving routes on an Orator instance.
 * Wraps Orator.addStaticRoute with service-provider lifecycle integration.
 */
class OratorStaticServer extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'OratorStaticServer';

		// Keep track of registered static routes for introspection
		this.routes = [];
	}

	/**
	 * Add a static file serving route to the Orator instance.
	 *
	 * @param {string} pFilePath - The path on disk to serve files from.
	 * @param {string} [pDefaultFile='index.html'] - The default file for directory requests.
	 * @param {string} [pRoute='/*'] - The route pattern to match.
	 * @param {string} [pRouteStrip='/'] - URL prefix to strip before filesystem lookup.
	 * @param {object} [pParams={}] - Additional parameters passed to serve-static.
	 * @returns {boolean} true if the route was successfully installed.
	 */
	addStaticRoute(pFilePath, pDefaultFile, pRoute, pRouteStrip, pParams)
	{
		if (!this.fable.Orator)
		{
			this.log.error('OratorStaticServer requires an Orator instance to be registered with Fable.');
			return false;
		}

		let tmpResult = this.fable.Orator.addStaticRoute(pFilePath, pDefaultFile, pRoute, pRouteStrip, pParams);

		if (tmpResult)
		{
			this.routes.push(
				{
					filePath: pFilePath,
					defaultFile: pDefaultFile || 'index.html',
					route: pRoute || '/*',
					routeStrip: pRouteStrip || '/',
					params: pParams || {}
				});
		}

		return tmpResult;
	}
}

module.exports = OratorStaticServer;
